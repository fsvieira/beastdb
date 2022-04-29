const short = require('short-uuid');
const ISet = require('./iset');
const IMap = require('./imap');
const {SHA256} = require("sha2");

class Record {
    constructor(table, id, data={}, saved=false, loaded=true) {
        this.table = table;
        this._data = data;

        this.idField = this.table.schema.key;
        this._id = this._data[this.idField.id] = id;

        this.proxy = new Proxy(this, this);

        this.saved = saved;
        this.loaded = loaded;
    }

    setData (data) {
        this._data = data;
        this._data[this.idField.id] = this.id;
    }

    static getID (idField, data={}) {
        let id = data[idField.id];

        if (!id) {
            const fields = idField.fields;

            if (fields.length > 0) {
                const ids = [];
                for (let i=0; i<fields.length; i++) {
                    const field = fields[i];

                    const value = data[field];
                    if (value instanceof IMap || value instanceof ISet) {
                        ids.push(value.id);
                    }
                    else {
                        ids.push(SHA256(JSON.stringify(value === undefined?null:value)).toString('base64'));
                    }
                }

                id = SHA256(JSON.stringify(ids.sort())).toString('base64');
            }
        }

        if (!id) {
            id = short.generate();
        }

        return id;
    }

    get id () {
        return this._id;
    }

    get data () {
        return this.proxy;
    }

    validate (isWrite, field) {
        if (isWrite && (this.idField.id === field || this.idField.fields.includes(field))) {
            throw `Can't change primary key field ${field} after initialization!`;
        }
    }

    async update (data) {
        for (let field in data) {
            const value = data[field];
            this.validate(true, field, value);
        }

        const oldData = this._data;

        this._data = {
            ...this._data,
            ...data
        };

        await this.save(oldData);

        return this;
    }

    set () {
        throw 'Read only field, please use update method!';
    }

    async get (target, prop) {
        this.validate(false, prop);

        const value = target._data[prop];

        if (value === undefined) {
            return null;            
        }

        return value;
    }

    async save(oldData) {
        const {name, schema} = this.table;

        await this.table.db.saveRecord(
            name,
            schema,
            this,
            oldData
        );

        this.saved = true;
        this.loaded = false;

        return this;
    }
}

module.exports = Record;