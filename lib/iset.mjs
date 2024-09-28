import IMap from './imap.mjs';

export default class ISet extends IMap {
    key2string (key) {
        if (key.constructor.name === 'Record') {
            return `${key.table.name}:${key.id}`;
        }
        else if (key.constructor.name === 'ISet' || key.constructor.name === 'IMap' || key.constructor.name === 'IArray') {
            return key.id;
        }
        else if (key.constructor.name === 'Date') {
            return key.toString();
        }

        return JSON.stringify(key);
    }

    hash (key) {
        const type = key?key.constructor.name:typeof key;
        return this.db.hashFn(`${type}:${this.key2string(key)}`);
    }

    async has (value) {
        return (await super.get(this.hash(value))) !== undefined;
    }

    async add (value) {
        return super.set(this.hash(value), value);
    }

    async remove (value) {
        return super.remove(this.hash(value));
    }

    async toArray () {
        const array = await super.toArray();
        return array.map(([_, value]) => value);
    }

    async toJS () {
        return super.toJS();
    }
}

