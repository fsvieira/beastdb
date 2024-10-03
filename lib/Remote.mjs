export default class Remote {
    static cmds = {
        GETNODE: 1,
        ADDNODE: 2,
        GETRECORD: 3,
        FINDRECORDS: 4,
        ADDRECORDS: 5
    };
        
    constructor ({remoteFirst=false, remoteLast=false}, db) {
        this.remoteFirst = remoteFirst;
        this.remoteLast=remoteLast;
        this.db = db;
    }

    setDB(db) {this.db = db;}

    // async createDatabase () {}

    async router(cmd, payload, send) {
        switch (cmd) {
            case Remote.cmds.GETNODE: {
                return send(
                    await this.db.serializeNode(
                        inode.constructor.name, 
                        inode.id
                    )
                );
            }

            case Remote.cmds.ADDNODE: {
                return this.db.saveNode(payload);
            }

            case Remote.cmds.GETRECORD: {
                const {
                    tableName,
                    recordID,
                    lastHash
                } = payload;

                return send(
                    await this.db.tables[tableName]
                        .serializeRecordChanges(recordID, lastHash)
                );
            }

            case Remote.cmds.FINDRECORS: {
                const {
                    tableName,
                    queryObj
                } = payload;

                const changes = [];
                for await (let record of this.db.tables[tableName].localFindByIndex(queryObj)) {
                    const localChanges = await this.db.tables[tableName].serializeRecordChanges(record._id); 
                    changes.push(...localChanges);
                };

                return send(changes);
            }

            case Remote.cmds.ADDRECORDS: {
                const { changes } = payload;
                return applyRecordChanges(changes);
            }
        }
    }

    async broadcast (cmd, payload, maxAnwsers=0) {
        throw 'broadcast not implemented';
    }

    // nodes,
    async pullNode (inode) {
        // request the node from remote peers and save it.
        // throw Error('Pull Node is not implemented');
        const [data] = await this.broadcast(Remote.cmds.GETNODE, {
            type: inode.constructor.name, 
            id: inode.id
        }, 1); 
        
        if (data) {
            return await this.db.saveNode(data)
        }
    }

    async pushNode (node) {
        const payload = await node.serializeNode(
            inode.constructor.name, 
            inode.id
        );

        return await this.broadcast(Remote.cmds.ADDNODE, payload);
    }

    // records
    async pullRecordChanges (tableName, recordID, lastHash=null) {
        const changes = await this.broadcast(
            Remote.cmds.GETRECORD, 
            {tableName, recordID, lastHash},
            100
        );

        const [record] = await this.db.applyRecordChanges(changes);

        return record;
    }

    async pullRecordChangesByIndex (tableName, queryObj) {
        const changes = await this.broadcast(
            Remote.cmds.FINDRECORDS, 
            {tableName, queryObj},
            -1 // Infinity 
        );

        return this.db.applyRecordChanges(changes);
    }

    async pushRecordChanges (changes) {
        return this.broadcast(
            Remote.cmds.ADDRECORDS, 
            {changes}
        );
    }

}
