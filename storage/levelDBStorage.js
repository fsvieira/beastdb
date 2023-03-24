const { Level } = require('level');
const path = require('path');

class LevelDBStorage {
    constructor ({dbsPath, dbname}) {
        this.path = path.join(dbsPath, dbname); 
        this.storage = new Level(
            this.path,
            { valueEncoding: 'json' }
        );
    }

    async batch (writes) {
        return this.storage.batch(writes);
    }

    async *iterator(query) {
        return this.storage.iterator(query);
    }

    async put(key, value) {
        return this.storage.put(key, value);
    }

    async get (key) {
        return this.storage.get(key);
    }

    async clear() {
        return this.storage.clear();
    }

    async close() {
        return this.storage.close();
    }

}

module.exports = LevelDBStorage;

