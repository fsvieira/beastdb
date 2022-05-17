// const short = require('short-uuid');
const {SHA256} = require("sha2");
const asyncChain = require("asyncake");

class IMap {
    constructor (db, {keys=new Map(), value, id, size=0, saved=false, loaded=true}={}) {
        this.keys = keys;
        this.value = value;
        this.size = size;

        this.db = db;
        this.id = id || IMap.getID(this.keys, value, size);
        this.saved = saved;
        this.loaded = loaded;
    }

    static getID (keys=new Map(), value, size) {        
 
        if (value && ['ISet', 'IMap', 'Record'].includes(value.constructor.name)) {
            value = value.constructor.name + ":" + value.id;
        }
        else if (value instanceof Date) {
            value = value.toISOString();
        }

        return SHA256(
            JSON.stringify([
                [...keys].map(([label, node]) => `${label}:${node.id}`).sort(),
                size,
                value
            ])
        ).toString('base64');
    }

    async getNode (data) {
        const {keys, value, size} = data;
        const id = IMap.getID(keys, value, size);

        return (await this.db.getNode(this.constructor, id)) || new this.constructor(
            this.db,
            data
        );
    }

    serialize () {
        const keys = [...this.keys].map(([label, node]) => [label, node.id]);

        return {
            id: this.id,
            keys,
            size: this.size,
            value: this.db.encode(this.value)
        };
    }

    getWrites (nodes=[]) {
        if (!this.saved && !nodes.includes(this)) {
            nodes.push(this);

            for (let [key, node] of this.keys) {
                node.getWrites(nodes);
            }

            if (this.value !== undefined) {
                if (this.value instanceof IMap) {
                    this.value.getWrites(nodes);
                }
            }
        }

        return nodes;
    }

    async load () {
        if (!this.loaded) {
            await this.db.loadNode(this);
        }
    }

    async remove (key) {
        return (await this._remove(key)) || this.db.iMap(); // Send empty imap
    }

    async _remove (key, depth=0) {
        await this.load();

        if (depth === key.length) {
            if (this.value !== undefined) {
                if (this.keys.size === 0) {
                    return null;
                }
                
                return this.getNode(
                    {keys: this.keys, size: this.size - 1}
                );
            }
            // nothing to delete
        }
        else {
            const c = key.charAt(depth);

            let n = this.keys.get(c);

            if (n) {
                const node = await n._remove(key, depth+1);

                if (node === null) {
                    if (this.keys.size === 1) {
                        return null;
                    }

                    return this.getNode(
                        {
                            keys: new Map(this.keys).delete(c), 
                            value: this.value,
                            size: this.size - 1
                        }
                    );
                }
                else if (n !== node) {
                    return this.getNode(
                        {
                            keys: new Map(this.keys).set(c,  node), 
                            value: this.value,
                            size: this.size + node.size - n.size
                        }
                    );
                }
            }
        }

        return this;
    }

    async fromJSON (json) {
        if (json instanceof Array) {
            const m = {};
            for (let i=0; i<json.length; i++) {
                m[i] = await this.fromJSON(json[i]);
            }

            return this.multiSet(m);
        }
        else if (json instanceof Object) {
            if (json._value) {
                return json._value;
            }
            else {
                const m = {};
                for (let key in json) {
                    m[key] = await this.fromJSON(json);
                }

                return this.multiSet(m);
            }
        }

        return json;
    }

    async multiSet (obj) {
        let s = this;
        for (let key in obj) {
            const value = obj[key];
            s = await s.set(key, value);
        }

        return s;
    }

    async set (key, value, depth=0) {
        await this.load();

        if (depth === key.length) {
            if (this.value !== value) {
                return this.getNode(
                    {keys: this.keys, value, size: this.size + (this.value===undefined?1:0)}
                );
            }
        }
        else {
            const c = key.toString().charAt(depth);

            let n = this.keys.get(c);

            if (!n) {
                n = await this.getNode(
                    {value, size: 1}
                );

                for (let i=key.length-1; i>depth; i--) {
                    const c = key.charAt(i);
                    n = await this.getNode(
                        {keys: new Map([[c, n]]), size: 1}
                    );
                }

                return this.getNode({
                    keys: new Map(this.keys).set(c, n), 
                    value: this.value, 
                    size: this.size + 1
                });
            }
            else {
                const node = await n.set(key, value, depth+1);

                if (n !== node) {
                    return this.getNode({
                        keys: new Map(this.keys).set(c,  node), 
                        value: this.value,
                        size: this.size + (node.size - n.size)
                    });
                }
            }
        }

        return this;
    }

    async get (key, depth=0) {
        await this.load();
        if (depth === key.length) {
            return this.value;
        }
        else {
            const c = key.charAt(depth);
            const n = this.keys.get(c);

            if (n) {
                return await n.get(key, depth+1);
            }
        }
    }

    async *[Symbol.asyncIterator]() {
        await this.load();

        if (this.value !== undefined) {
            yield ['', this.value];
        }

        for (let [head, node] of this.keys) {
            for await (let [tail, value] of node) {
                yield [head + tail, value];
            }
        }
    } 

    async *values () {
        for await (let [_, value] of this) {
            yield value;
        }
    }

    async *keys () {
        for await (let [key, value] of this) {
            yield key;
        }
    }

    async keysToArray () {
        const r = [];
        for await (let [key, value] of this) {
            r.push(key);
        }

        return r;
    }

    async toArray () {
        const r = [];
        for await (let [key, value] of this) {
            r.push([key, value]);
        }

        return r;
    }

    get chain () {
        return asyncChain(this);
    }
}

module.exports = IMap;
