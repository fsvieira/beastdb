
export default class SingletonCache {
    constructor (maxCacheElements=1000) {
        this.data = new Map();
        this.cleanUps = new Map();
        this.registry = new FinalizationRegistry(id => {
            this.data.delete(id); // Remove the record from the cache when it's garbage collected
            const cleanUp = this.cleanUps.get(id);
            this.cleanUps.delete(id);
            cleanUp && cleanUp();
        });

        this.maxCacheElements = maxCacheElements;
        this.keeps = [];
    }
    
    keep (ref) {
        if (ref) {
            this.keeps.unshift(ref);
            this.keeps.length = Math.min(this.keeps.length, this.maxCacheElements);
        }

        return ref;
    }

    get (id) {
        const o = this.data.get(id);

        return this.keep(o?.deref()); 
    }

    set (id, obj, cleanUp) {
        const o = this.get(id);
        if (!o) {
            const weakRef = new WeakRef(obj);
            this.data.set(id, weakRef);
            cleanUp && this.cleanUps.set(id, cleanUp);
            this.registry.register(obj, id);

            this.keep(obj);
        }
        else if (o !== obj) {
            throw new Error("Can't cache different objects under the same id.");
        }

        return this;
    }
}

