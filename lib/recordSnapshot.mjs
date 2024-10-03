export default class RecordSnapshot {

    constructor (record, data) {
        this.record = record;
        this._data = data;
        this.data = {...data};
    }

    async canUpdate (hash) {

        if (!hash) {
            return 'new';
        }

        const hashHistory = this._data.__hashHistory;

        for (let i=0; i<hashHistory.length; i++) {
            const rHash = hashHistory[i];
            
            if (rHash === hash) {
                // if heads are equal then data is already updated!
                // else update.
                
                if (i === 0) {
                    // there is nothing to do because they are equal,
                    return 'equal';
                }
                else {
                    // this record is outdated
                    // pull, 
                    return 'outdated';
                }                
            }
        }

        // records have diverged.
        return 'divergent';
    }

    async update (localOnly=false) {
        await this.record.update(this.data);

        this._data = await this.record.getUpdatedData(localOnly);
        this.data = {...this._data};

        return this;
    }
}

