const { Level } = require('level');
const ISet = require('./iset');
const IMap = require('./imap');
const Record = require('./record');
const Table = require('./table');
const {encode, decode} = require('./types');

const {SHA256} = require("sha2");

class Storage {
    constructor ({path}) {
        this.path = path;
        this._tables = {};
        this.storage = new Level(path, { valueEncoding: 'json' });

        this.emptyIMap = new IMap(this);
        this.emptyISet = new ISet(this);

        this.data = new Map();
    }

    encode = value => encode(value, this);
    decode = async value => decode(value, this)

    /*
        Data keys
    */
    hashValues = (values, fields=Object.keys(values)) => SHA256(fields.sort().map(field => {
        let v = values[field];

        if (v instanceof IMap || v instanceof ISet) {
            v = this.labelType(v.constructor.name, v.id);
        }
        else if (v instanceof Date) {
            v = this.labelType(v.constructor.name, v.toISOString());
        }
        else if (v) {
            v = this.labelType(v.constructor.name, v);
        }

        return v===undefined?null:v;
    }).join(":")).toString('base64');

    indexID = fields => fields.sort().join("+");

    labelType = (type, value) => `${type.toLowerCase()}:${value}`;
    labelCollection = (type, id) =>  this.labelType(type, id);

    labelProp = (prop, tablename) => `table:${prop}:${tablename}`;  
    labelSchema = (tablename='') => this.labelProp('schema', tablename);
    labelData = (tablename, id) => `${this.labelProp('data', tablename)}:${id}`;
        
    labelIndexValue = (tablename, fields, values) => 
        `${this.labelProp('index', tablename)}:${this.indexID(fields)}:${
            this.hashValues(values, fields)
        }`;

    labelIndexValueId = (tablename, fields, values, id) => 
        `${this.labelIndexValue(tablename, fields, values)}:${id}`;
    

    /*
        DB/Tables
    */    
    async load () {
        for await (let [key, data] of this.query({gt: this.labelSchema()})) {
            this._tables[data.name] = new Table(this, data.name, data.schema);    
        }

        return this;
    }
    
    async save () {
        for (let tablename in this._tables) {
            this._tables[tablename].save();
        }
    }

    async saveTable (name, schema) {
        await this.set(
            this.labelSchema(name),
            {
                name,
                schema
            }
        );
    }

    /*
        Records
    */
    async loadRecord (record) {
        const key = this.labelData(record.table.name, record.id);
        const data = await this.get(key);

        if (data) {
            record.setData(await this.decode(data));
        }

        record.saved = true;
        record.loaded = true;
    }
    
    async saveRecord (name, schema, record, oldData) {
        const {id, _data: originalData} = record;
        const data = {...originalData};
        const writes = [];
        const nodes = [];
    
        // await db.batch([{ type: 'put', key: 'b', value: 2 }])
        for (let field in data) {
            const value = data[field];            
            data[field] = this.encode(value);

            if (value instanceof ISet || value instanceof IMap) {
                // data[field] = this.encode(value).id;
    
                let ns = value.getWrites();
                for (let i=0; i<ns.length; i++) {
                    const node = ns[i];
    
                    const key = this.labelCollection(node.constructor.name, node.id);

                    writes.push({
                        type: 'put',
                        key,
                        value: node.serialize()
                    });
    
                    this.data.set(key, node);

                    nodes.push(node);
                }
            }
        }
    
        const key = this.labelData(name, id);
        writes.push({
            type: 'put',
            key,
            value: data
        });

        for (let indexID in schema.indexes) {
            const fields = schema.indexes[indexID];
            const key = this.labelIndexValueId(name, fields, data, id);
            let oldKey = oldData ? this.labelIndexValueId(name, fields, oldData, id):undefined;

            if (key !== oldKey) {
                writes.push({
                    type: 'put',
                    key,
                    value: id
                });

                if (oldKey) {
                    writes.push({
                        type: 'del',
                        key: oldKey,
                        value: id
                    });    
                }
            }
        }

        await this.storage.batch(writes);
    
        this.data.set(key, record);

        for (let i=0; i<nodes.length; i++) {
            const node = nodes[i];
            node.saved = true;
            node.loaded = true;
        }
    }

    async getRecord (table, id) {
        const key = this.labelData(table.name, id);
        let record = this.data.get(key);

        if (!record) {
            let record = new Record(table, id);
            this.data.set(key, record);
        }

        return record;
    }

    /* 
        Collections (IMap, ISet) 
    */
    iMap () {
        return this.emptyIMap;
    }
    
    iSet () {
        return this.emptyISet;
    }

    async getMemNode (Type, id, create=false) {
        const key = this.labelCollection(Type.name, id);
        let n = this.data.get(key);

        if (!n && create) {
            n = new Type(this, {
                id, 
                loaded: false, 
                saved: true
            });

            this.data.set(key, n);
        }

        return n;
    }

    async getNode (T, id) {
        const key = this.labelCollection(T.name, id);
        let n = this.data.get(key);

        if (!n) {
            const data = await this.get(key);

            if (n) {
                n = new T(this, data);
                this.data.set(key, n);
            }
        }

        return n;
    }

    async loadNode (node) {
        const key = this.labelCollection(node.constructor.name, node.id);
        const data = await this.get(key);
        
        if (data) {
            const keys = [];
            for (let i=0; i<data.keys.length; i++) {
                const [label, id] = data.keys[i];
                keys.push([
                    label,
                    await this.getMemNode(node.constructor, id, true)
                ]);
            }

            node.keys = new Map(keys);
            node.value = await this.decode(data.value);
        }

        node.saved = true;
        node.loaded = true;
    }

    /*
        Query
    */
    async *findByIndex (table, obj) {
        const fields = Object.keys(obj);
        const indexID = this.indexID(fields);

        if (table.schema.indexes[indexID]) {
            const index = this.labelIndexValue(table.name, Object.keys(obj), obj);

            for await (let [key, id] of table.db.query({gt: index})) {
                // yield [key, data];
                yield await this.getRecord(table, id);
            }
        }
        else {
            throw `There is no index for ${indexID}, only index searches are suported by findByIndex.`;
        }
    }

    async *query (query) {
        for await (let [key, value] of this.storage.iterator(query)) {
            if (key.startsWith(query.gt)) {
                yield [key, value];
            }
            else {
                return;
            }
        }
    }

    async set(key, value) {
        await this.storage.put(key, value);
        return this;
    }

    async get(key) {
        try {
            return await this.storage.get(key);
        }
        catch (e) {
            return null;
        }
    }

    async clear() {
        await this.storage.clear();
        return this;
    }

    async close() {
        await this.storage.close();
        return this;
    }
}

module.exports = Storage;

