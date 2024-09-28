import IMap from './imap.mjs';

// TODO: make a better IArray ? the problem is remove.
export default class IArray extends IMap {

    get length () {
        return this.size;
    }

    async remove (index) {
        if (index === this.size-1) {
            const [array] = await this.pop();

            return array;
        }

        // TODO: create new array and return that,
        if (index >= 0 && index < this.size) {
            return super.set(index, null);
        }
        // else nothing to remove.
    }

    async getLastValue () {
        await this.load();
        const len = await this.length;
        if (len === 0) {
            return;
        }

        return this.get(len - 1);
    }

    async push (value) {
        const len = await this.length;
        return super.set(len, value);
    }

    async pop () {
        if (this.size > 0) {
            const index = this.size - 1;
            const value = await super.get(index)
            return [await super.remove(index), value];
        }

        return [this, null];
    }

    async setIndex(index, value) {
        if (index >= 0 && index <= this.size) {
            return super.set(index, value);
        }

        throw new Error(`Index ${index} out of bounds [0, ${this.size}].`);
    }

    async *[Symbol.asyncIterator]() {
        const len = await this.length;
        for (let i=0; i<len; i++) {
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

