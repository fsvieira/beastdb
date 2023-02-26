const IMap = require('./imap');

class IArray extends IMap {

    get length () {
        return this.size;
    }

    async remove (index) {
        if (index === this.size-1) {
            const [array] = await this.pop();

            return array;
        }
        if (index >= 0 && index < this.size) {
            return super.set(index, null);
        }
        // else nothing to remove.
    }

    async push (value) {
        return super.set(this.size, value);
    }

    async pop () {
        if (this.size > 0) {
            const index = this.size - 1;
            const value = await super.get(index)
            return [await super.remove(index), value];
        }

        return [this, null];
    }

    async set(index, value) {
        if (index >= 0 && index <= this.size) {
            return super.set(index, value);
        }

        throw new Error(`Index ${index} out of bounds [0, ${this.size}].`);
    }

    async *[Symbol.asyncIterator]() {

        for (let i=0; i<this.size; i++) {
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
