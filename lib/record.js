const short = require('short-uuid');
const asyncChain = require("asyncake");

class Record {
    constructor(table, id, data, saved=false, loaded=false) {        
        this.table = table;

        this.idField = this.table.schema.key;
        this._id = id;

        if (data) {
           this.setData(data);
        }

        this.proxy = new Proxy(this, this);

        this.saved = saved;
        this.loaded = loaded;
    }

    setData (data) {
        this._data = data;
        this._data[this.idField.id] = this.id;
        this._data.__version = this._data.__version || 1;
        this._data.__hashHistory = data.__hashHistory || this.table.db.iArray();
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

    async historyHashData () {
        const fields = Object.keys(this._data).filter(field => '__hashHistory' !== field);
        const hash = this.table.db.hashValues(this._data, fields);

        this._data.__hashHistory = await this._data.__hashHistory.push(hash);

        return this;
    }


    async save(oldData) {
        const {name, schema} = this.table;

        this._data.__version++;
        await this.historyHashData();

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

    async toJS () {
        // TODO:
        //   * check types.js (it has a js type representation),
        //   * check Imap it has a serialize method.

        const data = await this.data;

        const getValue = async value => {
            if (value?.toJS) {
                return {
                    encode: this.table.db.encode(value),
                    value: await value.toJS()
                };
            }
            else {
                return value;
            }
        }

        const r = {};
        for (let field in data) {
            r[field] = await getValue(data[field]);
        }

        return r;
        // return await this.table.db.encode(await this.data);
    }
}

module.exports = Record;