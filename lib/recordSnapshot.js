class RecordSnapshot {

    constructor(record, data) {
        this.record = record;
        this._data = data;
        this.data = {...data};
    }

    async update() {

        let changes = 0;
        for (let field in this.data) {
            if(this.data[field] !== this._data[field]) {
                changes++;
                break;
            }
        }

        if (changes > 0) {
            this.data.__version = this._data.__version + 1;
            await this.record.update(this.data);
        }

        this._data = await this.record.getUpdatedData();
        this.changes = {...this._data};

        return this;
    }

    serialize () {
        const result = {};

        for (let field in this.data) {
            result[field] = this.record.table.db.encode(this.data[field]);
        }

        const r = this.record.table.db.encode(this.record);
        r.recordData = result;
        return r;
    }
}

module.exports = RecordSnapshot;