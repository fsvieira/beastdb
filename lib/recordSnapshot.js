
class RecordSnapshot {

    constructor(record, data) {
        this.record = record;
        this._data = {...data};
        this._originalData = data;
    }

    get data () {
        return this._data;
    }

    async update() {

        const newData = {};

        for (let field in this._data) {
            if(field === '__hashHistory' ||  this._originalData[field] !== this._data[field]) {
                newData[field] = this._data[field];
            }
        }

        newData.__version = this._data.__version + 1;

        if (Object.keys(newData).length > 2) {

            await this.record.update(newData);

            // Refresh data and reset modifications after successful update
        }

        this._originalData = await this.record.getUpdatedData();
        this._data = {... this._originalData };

        return this;
    }
}

module.exports = RecordSnapshot;