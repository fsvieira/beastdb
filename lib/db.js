const IMap = require('./imap');
const ISet = require('./iset');
const IArray = require('./iarray');
const Table = require('./table');
const Storage = require('./storage');
const Exceptions = require('./exceptions');
const SingletonCache = require('./cache');

// const dbs = new Map();

class DB extends Storage {
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

    /*
    static async open (storage) {
        let db = dbs.get(storage.storage.path); // ?.deref();

        if (!db) {
            db = new DB(storage);
            dbs.set(storage.storage.path, db); // new WeakRef(db));
            await db.load();
        }

        return db;
    }*/
    
    async start () {
        await this.load();
        this.remote?.setDB(this);
    }

    get tables () {
        return this.tablesProxy;
    }

    async clear () {
        this._tables = {};
        await super.clear();
    }

    async close () {
        // dbs.delete(this.path);
        await super.close();        
    }
}

module.exports = {
    DB, 
    IMap, ISet, IArray, 
    Exceptions,
    SingletonCache
};

/*
export {
    DB, 
    IMap, ISet, IArray, 
    Exceptions,
    SingletonCache
}*/
