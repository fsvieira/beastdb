import IMap from './imap.mjs';
import ISet from './iset.mjs';
import IArray from './iarray.mjs';
import Table from './table.mjs';
import Storage from './storage.mjs';
import Exceptions from './exceptions.mjs';
import SingletonCache from './cache.mjs';
import Remote from './Remote.mjs';

import CryptoJS from 'crypto-js';

export default class BeastDB extends Storage {
    constructor (
        {
            storage,
            remote
        }, 
    ) {
        super(storage);

        this.remote = remote;
        
        const _db = this;
        this.tablesProxy = new Proxy(
            {}, 
            {
                get (target, prop) {
                    return _db._tables[prop] = _db._tables[prop] || new Table(_db, prop);  
                }
            } 
        );
    }

    hashFn (text) {
        return CryptoJS.SHA256(text).toString(CryptoJS.enc.Base64url);
    }

    async applyRecordChanges (changes) {
        let record;
        for (let i=0; i<changes.length; i++) {
            try {
                const encoded = changes[i];
                const snapshot = await this.decode(encoded);
                await snapshot.update(true);
                record = snapshot.record;
            }
            catch (e) {
                console.log(e);
            }
        }

        return record;
    }

    async serializeNode (typeStr, id) {
        const type = BeastDB.typesMap[typeStr];

        const node = await this.getNode(type, id);

        if (node) {
            return {
                node: this.encode(node),
                data: node.serialize()
            };
        }

        return null;
    }

    async start () {
        await this.load();
        this.remote?.setDB(this);
        await this.remote?.createDatabase();
    }

    get tables () {
        return this.tablesProxy;
    }

    async clear () {
        this._tables = {};
        await super.clear();
    }

    async close () {
        await super.close();        
    }
}

export {
    BeastDB,
    IMap, ISet, IArray,
    Exceptions,
    SingletonCache,
    Remote
};

