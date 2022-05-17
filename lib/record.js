const short = require('short-uuid');
/*const ISet = require('./iset');
const IMap = require('./imap');
const {SHA256} = require("sha2");*/
const asyncChain = require("asyncake");

class Record {
    constructor(table, id, data, saved=false, loaded=false) {
        this.table = table;

        this.idField = this.table.schema.key;
        this._id = id;

        if (data) {
            this._data = data;
            this._data[this.idField.id] = id;
        }

        this.proxy = new Proxy(this, this);

        this.saved = saved;
        this.loaded = loaded;
    }

    setData (data) {
        this._data = data;
        this._data[this.idField.id] = this.id;
    }

    static getID (db, idField, data={}) {
        let id = data[idField.id];

        if (!id) {
            const fields = idField.fields;

            if (fields.length > 0) {
                id = db.hashValues(data, fields);
            }
        }

        if (!id) {
            id = short.generate();
        }

        return id;
    }

    async load () {
        if (!this.loaded) {
            await this.table.db.loadRecord(this);
        }

        return this;
    }


    get id () {
        return this._id;
    }

    get data () {
        return asyncChain(this).load()._data;
        // return this.proxy;
    }

    validate (isWrite, field) {
        if (isWrite && (this.idField.id === field || this.idField.fields.includes(field))) {
            throw `Can't change primary key field ${field} after initialization!`;
        }
    }

    async update (data) {
        await this.load();
        for (let field in data) {
            this.validate(true, field);
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

    /*async get (target, prop) {
        await this.load();

        this.validate(false, prop);

        const value = target._data[prop];

        if (value === undefined) {
            return null;            
        }

        return value;
    }*/

    async save(oldData) {
        const {name, schema} = this.table;

        await this.table.db.saveRecord(
            name,
            schema,
            this,
            oldData
        );

        this.saved = true;
        this.loaded = true;

        return this;
    }
}

module.exports = Record;