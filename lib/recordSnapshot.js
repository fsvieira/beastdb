class RecordSnapshot {
    
    constructor (record, data) {
        this.record = record
        this._data = data;
        this._modifications = {};
    }

    get data () {
        return new Proxy(this._data, {
            get: (target, prop) => {
                // Read from _modifications if it exists, otherwise from _data
                if (prop in this._modifications) {
                    return this._modifications[prop];
                }

                return target[prop];
            },
            set: (target, prop, value) => {
                // Write changes to _modifications
                this._modifications[prop] = value;
                return true; // Indicate success
            }
        });
    }

    async update () {
        if (Object.keys(this._modifications).length > 0) {
            this._modifications.__version = this._data.__version + 1;
            this._modifications.__hashHistory = this._data.__hashHistory;

            await this.record.update(this._modifications);
            this._data = await this.record.getUpdatedData();
            this._modifications = {};
        }

        return this;
    }
}

module.exports = RecordSnapshot;