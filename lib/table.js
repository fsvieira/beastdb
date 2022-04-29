const Record = require('./record');

class Table {
    constructor(db, tablename, schema) {
        this.name = tablename;
        this.schema = schema || {
            key: {
                id: 'id',
                fields: []
            },
            indexes: {}
        };

        this.db = db;
        this.saved = !!schema;
        this.loaded = this.saved;
    }
    
    has (id) {
        return this.find(id) !== null;
    }

    async find (id) {
        return this.db.getRecord(this, id) || null;
    }

    key (id, fields=[]) {
        this.schema.key = {id, fields};
        return this;
    }

    index (...fields) {
        const indexID = this.db.indexID(fields);
        this.schema.indexes[indexID] = fields.sort();

        return this;
    }

    async *findByIndex (obj) {
        return yield *this.db.findByIndex(this, obj); 
    }

    async findByIndexArray (obj) {
        const r = [];

        for await (let record of this.findByIndex(obj)) {
            r.push(record);
        } 

        return r;
    }

    async insert (data, onDuplicated) {
        await this.save();

        const id = Record.getID(
            this.schema.key,
            data
        );

        let r = await this.find(id);
        
        if (!r) {
            r = new Record(this, id, data);
            await r.save();
        }
        else if (onDuplicated === undefined) {
            throw `Duplicated record ${id} on table ${this.name}!`;
        }
        else if (onDuplicated instanceof Function) {
            return await onDuplicated(r, data);
        }
        else if (onDuplicated instanceof Object) {
            return await r.update(onDuplicated)
        }
        else if (!(onDuplicated === false || onDuplicated === null)) {
            throw `Invalid onDuplicated value!`;
        }
        // else insert ignore.

        return r;
    }

    async save () {
        if (!this.saved) {
            await this.db.saveTable(
                this.name,
                this.schema
            );

            this.saved = true;
            this.loaded = true;
        }

        return this;
    }
}

module.exports = Table;
