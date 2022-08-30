const IMap = require('./imap');
const {SHA256} = require("sha2");

class ISet extends IMap {
    key2string (key) {
        if (key.constructor.name === 'Record') {
            return `${key.table.name}:${key.id}`;
        }
        else if (key.constructor.name === 'ISet' || key.constructor.name === 'IMap') {
            return key.id;
        }
        else if (key.constructor.name === 'Date') {
            return key.toString();
        }

        return JSON.stringify(key);
    }

    hash (key) {
        const type = key?key.constructor.name:typeof key;
        return SHA256(`${type}:${this.key2string(key)}`).toString('base64');
    }

    async has (value) {
        return (await super.get(this.hash(value))) !== undefined;
    }

    async multiAdd (values) {
        return super.multiSet(values.reduce(
            (acc, v) => acc[this.hash(value)] = v
            , {})
        );
    }

    async add (value) {
        return super.set(this.hash(value), value);
    }

    async remove (value) {
        return super.remove(this.hash(value));
    }

    async toArray () {
        return (await super.toArray()).map(([_, value]) => value);
    }

    async toJS () {
        // return this.db.encode(await this.toArray());
        return super.toJS();
    }

    // async toJS () {this.toArray() || []}
}

module.exports = ISet;
