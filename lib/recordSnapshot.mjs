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
        // const length = await hashHistory.length;

        for (let i=0; i<hashHistory.length; i++) {
        // for (let i=length-1; i>= 0; i--) {
            // const rHash = await hashHistory.get(i);
            const rHash = hashHistory[i];
            
            if (rHash === hash) {
                // if heads are equal then data is already updated!
                // else update.
                
                if (i !== length -1) {
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
        let changes = 0;

        for (let field in this.data) {
            if(this.data[field] !== this._data[field]) {
                changes++;
                break;
            }
        }

        if (changes > 0) {
            if (!localOnly && (this.data.__version <= this._data.__version)) {
                this.data.__version = this._data.__version + 1;
            }

            try {
                await this.record.update(this.data);
            }
            catch (e) {
                console.log(e);
                throw e;
            }
        }

        this._data = await this.record.getUpdatedData(localOnly);
        this.changes = {...this._data};

        return this;
    }
}

