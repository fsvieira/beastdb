const { Level } = require('level');
const ISet = require('./iset');
const IMap = require('./imap');
const Record = require('./record');
const Table = require('./table');

const {SHA256} = require("sha2");

const typesTable = {
    'ISet': ISet,
    'IMap': IMap,
    'Date': Date,
    'Record': Record
};

class Storage {
    constructor ({path}) {
        this.path = path;
        this._tables = {};
        this.storage = new Level(path, { valueEncoding: 'json' });

        this.emptyIMap = new IMap(this);
        this.emptyISet = new ISet(this);

        this.data = new Map();
    }

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
    labelCollection = (type, id) =>  this.labelType(type, id); // `${type.toLowerCase()}:${id}`; 

    labelProp = (prop, tablename) => `table:${prop}:${tablename}`;  
    labelSchema = (tablename='') => this.labelProp('schema', tablename);
    labelData = (tablename, id) => `${this.labelProp('data', tablename)}:${id}`;
    
    /*labelIndexValue = (tablename, fields, values) => 
        `${this.labelProp('index', tablename)}:${this.indexID(fields)}:${
            values.length?fields.sort().map(field => values[fields.indexOf(field)]):null
        }`;*/
    
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
            const {types} = data.schema;
    
            for (let field in types) {
                const type = types[field];
                types[field] = typesTable[type];
            }

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
        const schema2db = {
            ...schema,
            forangeKeys: {
                ...schema.forangeKeys,
                ids: {
                    ...schema.forangeKeys.ids
                }
            },
            types: {
                ...schema.types
            },
            indexes: {
                ...schema.indexes
            }
        };

        const ids = schema2db.forangeKeys.ids
        for (let key in ids) {
            ids[key] = ids[key].name;
        }

        const types = schema2db.types;
        for (let key in types) {
            types[key] = types[key].name;
        }

        await this.set(
            // `table:schema:${this.name}`, {
            this.labelSchema(name),
            {
                name,
                schema: schema2db
            }
        );
    }

    /*
        Records
    */
    async loadRecord (table, id) {
        const key = this.labelData(table.name, id);

        const data = await this.get(key);

        if (data) {
            const {types} = table.schema;
    
            for (let field in types) {
                const v = data[field];
                const T = types[field];
    
                if (T === ISet || T === IMap ) {
                    data[field] = new T(table.db, {id: v, loaded: false}); 
                }
                else if (T === Date) {
                    data[field] = new Date(v);
                }
            }
        
            const r = new Record(table, id, data, true, true);
            this.data.set(key, r);

            return r;
        }
    
        return null;
    }
    
    async saveRecord (name, schema, record) {
        const {id, _data: originalData} = record;
        const data = {...originalData};
        const writes = [];
        const nodes = [];
    
        // await db.batch([{ type: 'put', key: 'b', value: 2 }])
        for (let field in data) {
            const value = data[field];
    
            if (value instanceof ISet || value instanceof IMap) {
                data[field] = value.id;
    
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
            else if (value instanceof Date) {
                data[field] = data[field].toISOString();
            }
        }
    
        const key = this.labelData(name, id);
        writes.push({
            type: 'put',
            key,
            value: data
        });
        
        // forange key indexes,
        for (let field in schema.forangeKeys.ids) {
            writes.push({
                type: 'put',
                key: this.labelIndexValueId(name, [field], data, id),
                value: id
            });    
        }

        for (let indexID in schema.indexes) {
            const fields = schema.indexes[indexID];
            writes.push({
                type: 'put',
                key: this.labelIndexValueId(name, fields, data, id),
                value: id
            });    
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
        return this.data.get(key) || this.loadRecord(table, id);
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
                id, loaded: false
            });

            this.data.set(key, n);
        }

        return n;
    }

    async getNode (type, id) {
        const key = this.labelCollection(type, id);
        let n = this.data.get(key);

        if (!n) {
            n = await this.get(key);

            this.data.set(key, n);
        }

        return n;
    }

    async loadNode (node) {
        const key = this.labelCollection(node.constructor.name, node.id);
        const data = await this.get(key);
        
        if (data) {
            const keys = data.keys.map(([label, id]) => [
                label,
                this.getMemNode(node.constructor, id)
            ]);

            node.keys = new Map(keys);

            let {value, valueType} = data;
            const T = typesTable[valueType]

            if (T) {
                if (T.name === 'ISet' || T.name === 'IMap') {
                    value = new T(node.db, {id: value, loaded: false});
                }
                else if (T.name === 'Record') {
                    value = new T(node.db, {id: value, loaded: false});
                }
                else if (T.name === 'Date') {
                    value = new Date(value);
                }
            }

            node.value = value;
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

