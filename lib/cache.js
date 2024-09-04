
class SingletonCache {
    constructor () {
        this.data = new Map();
        this.registry = new FinalizationRegistry((id) => {
            this.data.delete(id); // Remove the record from the cache when it's garbage collected
        });
    }

    get (id) {
        const o = this.data.get(id);

        return o?.deref();
    }

    set (id, obj) {
        const o = this.get(id);
        if (!o) {
            const weakRef = new WeakRef(obj);
            this.data.set(id, weakRef);

            this.registry.register(obj, id);
        }
        else if (o !== obj) {
            throw new Error("Can't cache different objects under the same id.");
        }

        return this;
    }
}

module.exports = SingletonCache;

