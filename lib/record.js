const short = require('short-uuid');
const asyncChain = require("asyncake");
const {RecordUpdateConflictException} = require("./exceptions");

const RecordSnapshot = require("./recordSnapshot");

class Record {
    constructor(table, id, data, saved=false, loaded=false) {        
        this.table = table;

        this.idField = this.table.schema.key;
        this._id = id;

        if (data) {
           this.setData(data);
        }

        this.saved = saved;
        this.loaded = loaded;
    }

    async setData (data) {
        this._data = Object.freeze({
            ...data,
            [this.idField.id]: this.id
        });
        // this._data[this.idField.id] = this.id;
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

    async getUpdatedData () {
        await this.load();
        return this._data;
    }

    async snapshot () {
        return new RecordSnapshot(
            this,
            await this.getUpdatedData()
        );
    }

    get id () {
        return this._id;
    }

    get data () {
        return asyncChain(this).load()._data;
    }

    /*
    validate (isWrite, field) {
        if (isWrite && (this.idField.id === field || this.idField.fields.includes(field))) {
            throw `Can't change primary key field ${field} after initialization!`;
        }
    }*/

    async hashData (data) {
        const fields = Object.keys(data).filter(field => '__hashHistory' !== field);
        let hash = await this.table.db.hashValues(data, fields);
        
        return hash;
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
        const queuedUpdate = this._enqueueUpdate(this._updateQueue, data);

        queuedUpdate.finally(() => {
            if (this._updateQueue === queuedUpdate) {
                this._updateQueue = null;            
            }
        });

        this._updateQueue = queuedUpdate;

        return queuedUpdate;
    }
    
    async _update (data) {
        await this.load();
        /*for (let field in data) {
            this.validate(true, field)
        }*/

        const ids = this.idField.fields.concat(this.idField.id);
        for (let i=0; i<ids.length; i++) {
            const id = ids[i];
            const value = data[id];

            if (value !== undefined && value !== this._data[id]) {
                throw `Can't change primary key field ${this.idField.id} after initialization!`;
            }
        }

        

        const newData = {
            ...this._data,
            ...data
        };

        const hash = await this.hashData(newData);
        newData.__hashHistory = await newData.__hashHistory.push(hash);

        if (await this.canUpdate(newData)) {
            const oldData = this._data;
            this._data = newData;

            await this.save(oldData);    
        }

        return this;
    }

    async _enqueueUpdate (existingPromise, data) {
        if (existingPromise) {
            try {
                await existingPromise;  // Wait for the previous insert to finish
            } catch (error) {
                // Log error, but continue with the next insertion
                console.error(error);
            }
        }

        return this._update(data);
    }

    set () {
        throw 'Read only field, please use update method!';
    }

    async save(oldData) {
        const {name, schema} = this.table;

        if (!oldData) {
            const newData = {
                ...this._data,
                __version: 1
            }

            const hash = await this.hashData(newData);
            newData.__hashHistory = await this.table.db.iArray().push(hash);
            this._data = Object.freeze(newData);
        }

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
    }
}

module.exports = Record;