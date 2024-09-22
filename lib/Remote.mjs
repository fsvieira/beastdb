export default class Remote {
    
    constructor ({remoteFirst=false, remoteLast=false}, db) {
        this.remoteFirst = remoteFirst;
        this.remoteLast=remoteLast;
        this.db = db;
    }

    setDB(db) {this.db = db;}

    async createDatabase () {}

    // nodes,
    async pullNode (node) {
        // request the node from remote peers and save it.
        throw Error('Pull Node is not implemented');
    }

    async pushNode (node) {
        // send node to remote peers,
        throw Error('Push Node is not implemented');
    }

    // records
    async pullRecordChanges (tableName, recordID, lastHash=null) {
        // 1. request changes of recordID from other peers  
        // 2. call applyChanges to apply changes on this db.
        throw Error('Pull Record Changes is not implemented');

    }

    async pullRecordChangesByIndex (tableName, queryObj) {
        // 1. request changes of all records found on query obj, 
        // 2. call applyChanges to apply changes on this db.
        throw Error('Pull Records Changes By Index is not implemented');
    }

    async pushRecordChanges (changes) {
        // just send changes,
        throw Error('Push Record Changes is not implemented');
    }

}
