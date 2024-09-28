import Record from './record.mjs';

export default class Table {
    constructor(db, tablename, schema) {
        this.name = tablename;
        this.schema = schema || {
            key: {
                id: 'id',
                fields: []
            },
            indexes: {}
        };

        this.db = db;
        this.saved = !!schema;
        this.loaded = this.saved;

        this.insertQueue = new Map();
    }
    
    has (id) {
        return this.find(id) !== null;
    }

    localHas (id) {
        return this.localFind(id) !== null;
    }

    async find (id) {
        let local = await this.localFind(id);

        if (!local) {
            local = await this.db.remote?.pullRecordChanges(this.name, id);
        }

        return local;
    }

    async localFind (id) {
        return this.db.getSavedRecord(this, id);
    }

    key (id, fields=[]) {
        this.schema.key = {id, fields};
        return this;
    }

    index (...fields) {
        const indexID = this.db.indexID(fields);
        this.schema.indexes[indexID] = fields.sort();

        return this;
    }

    async *findByIndex (obj) {
        const remote = this.db.remote;
        if (remote) {
            const p = remote.pullRecordChangesByIndex(this.name, obj).then(
                changes => this.db.applyRecordChanges(changes)
            );

            if (remote.remoteFirst) {
                await p;
            }
        }

        return yield *this.localFindByIndex(obj);
    }

    async *localFindByIndex (obj) {
        return yield *this.db.findByIndex(this, obj);
    }

    async findByIndexArray (obj) {
        const r = [];

        for await (let record of this.findByIndex(obj)) {
            r.push(record);
        } 

        return r;
    }
 
    async insert(data, onDuplicated) {
        await this.save();

        const id = Record.getID(this.db, this.schema.key, data);
        const processing = this.insertQueue.get(id);

        const insertionPromise = this.queueInsert(processing, id, data, onDuplicated);
        this.insertQueue.set(id, insertionPromise);

        insertionPromise.finally(() => {
            if (this.insertQueue.get(id) === insertionPromise) {
                this.insertQueue.delete(id);
            }
        });

        return insertionPromise;
    }

    async queueInsert(existingPromise, id, data, onDuplicated) {
        if (existingPromise) {
            try {
                await existingPromise;  // Wait for the previous insert to finish
            } catch (error) {
                // Log error, but continue with the next insertion
                console.error(`Error in previous insert for ${id}:`, error);
            }
        }

        return this.processInsert(id, data, onDuplicated);
    }

    async processInsert (id, data, onDuplicated) {
        let r = await this.localFind(id);
        
        if (!r) {
            r = new Record(this, id, data, false, true);
            await r.save();
        }
        else if (onDuplicated === undefined) {
            throw new Error(`Duplicated record ${id} on table ${this.name}!`);
        }
        else if (onDuplicated instanceof Function) {
            r = await onDuplicated(r, data);
        }
        else if (onDuplicated instanceof Object) {
            r = await r.update(onDuplicated)
        }
        else if (!(onDuplicated === false || onDuplicated === null)) {
            throw new Error(`Invalid onDuplicated value!`);
        }
        // else insert ignore.

        return r;
    }

    async save () {
        if (!this.saved) {
            await this.db.saveTable(
                this.name,
                this.schema
            );

            this.saved = true;
            this.loaded = true;
        }

        return this;
    }

    async serializeRecordChanges (id, hash) {
        const srcRecord = await this.localFind(id);
        if (srcRecord) {
            const s = await srcRecord.snapshot();
            const action = await s.canUpdate(hash);

            switch (action) {
                case 'equal':
                    return [];
                case 'outdated':
                    // nothing to send,
                    // TODO: but should we pull ? 
                    return [];
                default: 
                    const encoded = this.db.encode(s);
                    return [encoded];
            }
        }

        return [];
    }
}
