class RecordSnapshot {

    constructor(record, data) {
        this.record = record;
        this._data = data;
        this.changes = {...data};
    }

    get data () {
        return this._data;
    }

    async update() {

        let changes = 0;
        for (let field in this.changes) {
            if(this.changes[field] !== this._data[field]) {
                changes++;
                break;
            }
        }

        if (changes > 0) {
            this.changes.__version = this.changes.__version + 1;

            await this.record.update(this.changes);

            // Refresh data and reset modifications after successful update
        }

        this._data = await this.record.getUpdatedData();
        this.changes = {...this._data};

        return this;
    }
}

module.exports = RecordSnapshot;