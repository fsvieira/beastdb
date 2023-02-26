const IMap = require('./imap');

class IArray extends IMap {
    
    async push (value) {
        return super.set(super.size, value);
    }

    async pop () {
        if (super.size > 0) {
            const value = await super.get(super.size -1)
            return [await super.remove(super.size -1), value];
        }

        return [this, null];
    }

    async set(index, value) {
        if (index >= 0 && index <= super.size) {
            return super.set(index, value);
        }

        throw new Error(`Index is outside array, index ${index} is not in in the range of 0 to ${super.size}.`);
    }

    async *[Symbol.asyncIterator]() {

        for (let i=0; i<super.size; i++) {
            const value = await super.get(i);

            yield value;
        }
    } 

    async toArray () {
        const array = [];
        for await (let v of this) {
            array.push(v);
        }

        return array;
    }

    async toJS () {
        return super.toJS();
    }

}

module.exports = IArray;
