import short from 'short-uuid';
import asyncChain from "asyncake";
import {RecordUpdateConflictException} from "./exceptions.mjs";

import RecordSnapshot from "./recordSnapshot.mjs";
import { __version } from 'fast-check';

export default class Record {
    constructor(table, id, data, saved=false, loaded=false) {        
        this.table = table;

        this.idField = this.table.schema.key;
        this._id = id;

        if (data) {
           this.setData(data);
        }

        this.saved = saved;
        this.loaded = loaded;
        this.pulling = false;
    }

    setData (data) {
        this._data = Object.freeze({
            ...data,
            [this.idField.id]: this._id
        });

        /*const d = {
            __version: 1,
            ...data,
            [this.idField.id]: this._id
        }

        const hash = this.hashData(d);
        this._data = Object.freeze({
            __hashHistory: Object.freeze([hash]),
            ...d
        });*/
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
        await this.loadLocal();
        await this.loadRemote();

        return this;
    }

    async loadLocal () {
        if (!this.loaded) {
            await this.table.db.loadRecord(this);
            return this;
        }
    }

    lastHash (data=this._data) {
        return data.__hashHistory[0];
    }

    async loadRemote () {
        if (this.table.db.remote && 
            !this.pulling
        ) {
            this.pulling = true;
            const remote = this.table.db.remote;

            if (remote.remoteFirst || remote.remoteLast) {
                const p = remote.pullRecordChanges(
                    this.table.name,
                    this._id,
                    this.lastHash()
                ).finally(() => this.pulling = false);

                if (remote.remoteFirst) {
                    return await p; 
                }
            }
        }
    }

    async pushChanges () {
        const remote = this.table.db.remote; 
        if (remote) {
            const s = await this.snapshot();
            const encoded = this.table.db.encode(s);
            remote.pushRecordChanges([encoded]);
        }
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

    hashData (data) {
        const fields = Object.keys(data).filter(field => '__hashHistory' !== field);
        let hash = this.table.db.hashValues(data, fields);
        
        return hash;
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

    async _update (data) {
        await this.loadLocal();

        const ids = this.idField.fields.concat(this.idField.id);
        for (let i=0; i<ids.length; i++) {
            const id = ids[i];
            const value = data[id];

            if (value !== undefined && value !== this._data[id]) {
                throw `Can't change primary key field ${this.idField.id} after initialization!`;
            }
        }

        let newData = {
            ...this._data,
            ...data
        };

        return this.save(newData);
    }

    set () {
        throw 'Read only field, please use update method!';
    }

    async save (newData) {
        if (!newData) {
            // its an insert,
            newData = {
                ...this._data,
                __version: 1
            };

            const hash = this.hashData(newData);
            newData.__hashHistory = Object.freeze([hash]);
            this._data = Object.freeze(newData);

            return this._save();
        }

        // 1. Can B replace A? (Check if B can be applied)
        const currentHash = this.lastHash();

        if (!newData.__hashHistory.includes(currentHash)) {
            throw new RecordUpdateConflictException(`currentHash ${currentHash} not found in newData History!`);
        }
        
        // 2. Is there any change? (Check if newRecord is different from savedRecord)
        let newHash = this.hashData(newData);
        const newDataVersion = newData.__version;

        if (newDataVersion === this._data.__version
            && newHash === currentHash
        ) {
            // there is no changes,
            return this;
        }
        
        // 3. Should we update the version? (Check if B has a higher version or increment A's version)
        newData.__version = Math.max(newDataVersion, this._data.__version + 1);
        
        if (newDataVersion !== newData.__version) {
            newHash = this.hashData(newData);
        }

        // 4. Generate a new hash for B (if necessary)
        if (this.lastHash(newData) !== newHash) {
            newData.__hashHistory = [newHash].concat(newData.__hashHistory);
        }

        const newHashesSet = new Set(newData.__hashHistory);
        const oldHashes = this._data.__hashHistory.filter(
            h => !newHashesSet.has(h)
        );

        // Cap hash history to 100 entries
        newData.__hashHistory = Object.freeze(newData.__hashHistory.concat(oldHashes).slice(0, 100));
        
        const oldData = this._data;
        this._data = Object.freeze(newData);

        return this._save(oldData);
    }
    
    async _save (oldData) {
        const {name, schema} = this.table;

        await this.table.db.saveRecord(
            name,
            schema,
            this,
            oldData
        );

        this.saved = true;
        this.loaded = true;

        this.pushChanges();

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

        return {
            encode: this.table.db.encode(this),
            value: r
        };
    }
}
