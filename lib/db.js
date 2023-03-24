const IMap = require('./imap');
const ISet = require('./iset');
const IArray = require('./iarray');
const Table = require('./table');
const Storage = require('./storage');

// const dbs = new Map();

class DB extends Storage {
    constructor (storage) {
        super(storage);

        const _db = this;
        this.tablesProxy = new Proxy(
            {}, 
            {
                get (target, prop) {
                    return _db._tables[prop] = _db._tables[prop] || new Table(_db, prop);  
                }
            } 
        )
    }

    static async open (storage) {
        const db = new DB(storage);
        // dbs.set(storage.path, db); // new WeakRef(db));
        await db.load();

        return db;
        /*let db = dbs.get(storage.path); // ?.deref();

        if (!db) {
            db = new DB(storage);
            dbs.set(storage.path, db); // new WeakRef(db));
            await db.load();
        }

        return db;*/
    }

    get tables () {
        return this.tablesProxy;
    }

    async clear () {
        this._tables = {};
        await super.clear();
    }

    async close () {
        // dbs.delete(this.storage.path);
        await super.close();        
    }
}

module.exports = {DB, IMap, ISet, IArray};

