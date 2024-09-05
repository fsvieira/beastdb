const short = require('short-uuid');
const asyncChain = require("asyncake");

/*
Custom Record Exceptions
*/
class UpdateConflict extends Error {
    constructor(message) {
        super(message);  // Pass the message to the base Error class
        this.name = this.constructor.name;  // Ensure the error has a unique name
    }
}

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
        this.updatedHashData = false;
    }

    async setData (data) {
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

    async updateVersionHashData (data) {
        const newData = {
            ...this._data,
            ...data
        };

        const fields = Object.keys(newData).filter(field => '__hashHistory' !== field);

        const hashHistory = newData.__hashHistory;

        let hash = await this.table.db.hashValues(newData, fields);
        const lastHash = await hashHistory.getLastValue();

        if (hash !== lastHash) {
            if (lastHash) {
                newData.__version++;
                hash = await this.table.db.hashValues(newData, fields);
            }

            newData.__hashHistory = await hashHistory.push(hash);
        }

        return newData;
    }
    
    async canUpdate (newData) {
        let currentHistoryData = this._data.__hashHistory;
        let newHistoryData = newData.__hashHistory;

        const currentHash = await currentHistoryData.getLastValue();
        const length = await newHistoryData.length;

        for (let i=length-1; i>= 0; i--) {
            const hash = await newHistoryData.get(i);
            if (hash === currentHash) {
                // if heads are equal then data is already updated!
                // else update. 
                return i !== length - 1;
            }
        }

        throw new RecordUpdateConflictException(`currentHash ${currentHash} not found in newData History!`);
    }

    async update (data) {
        await this.load();
        for (let field in data) {
            this.validate(true, field)
        }

        /*
        this._data = {
            ...this._data,
            ...data
        };
        const newData = {
            ...this._data,
            ...data
        };*/

        if (!this.updatedHashData) {
            this._data = await this.updateVersionHashData({});
            this.updatedHashData = true;
        }

        const newData = await this.updateVersionHashData(data);

        if (await this.canUpdate(newData)) {
            const oldData = this._data;
            this._data = newData;

            await this.save(oldData);    
        }

        return this;
    }

    set () {
        throw 'Read only field, please use update method!';
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

    static Exceptions = {
        UpdateConflict
    }
}

module.exports = Record;