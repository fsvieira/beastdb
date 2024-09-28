import short from 'short-uuid';
import {Remote} from '../lib/beastDB.mjs'; 

export default class RemoteDummy extends Remote {

    constructor (options) {
        super(options);
        this.nodes = [];
    }    

    setDB(db) {
        this.db = db;
    }

    connect (node) {
        if (!this.nodes.includes(node)) {
            this.nodes.push(node);
            node.connect(this);
        }
    }

    async pushRecordChanges (changes) {
        for (let node of this.nodes) {
            await node.db.applyRecordChanges(changes);
        }

        return changes;
    }

    async pullRecordChanges (table, id, hash) {
        let changes = [];
        for (let node of this.nodes) {
            const cs = await node.db.tables[table].serializeRecordChanges(id, hash);
            changes = changes.concat(cs);
        }

        const record = await this.db.applyRecordChanges(changes);

        return record;
    }
    
    async pullNode (inode) {
        for (let node of this.nodes) {
            const data = await node.db.serializeNode(
                inode.constructor.name, 
                inode.id
            );

            if (data) {
                return this.db.saveNode(data);
            }
        }
    }
    
    async pullRecordChangesByIndex (tableName, queryObj) {
        try {    
            let changes = [];

            for (let i=0; i<this.nodes.length; i++) {
                const node = this.nodes[i];

                for await (let record of node.db.tables[tableName].localFindByIndex(queryObj)) {
                    const localChanges = await node.db.tables[tableName].serializeRecordChanges(record._id); 
                    changes.push(...localChanges);
                };
            }

            return changes;
        }
        catch (e) {
            console.log(e);
            throw e;
        }    
    }
}

