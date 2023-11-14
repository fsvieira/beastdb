// const short = require('short-uuid');
const {SHA256} = require("sha2");
const asyncChain = require("asyncake");

class IMap {
    constructor (db, {keys=new Map(), value, id, size=0, saved=false, loaded=true}={}) {
        this.keys = keys;
        this.value = value;
        this._size = size;

        this.db = db;
        this.id = id || this.getID(this.keys, value, size);
        this.saved = saved;
        this.loaded = loaded;
    }

    getID (keys=new Map(), value, size) {        
 
        /*
        if (value && ['IArray', 'ISet', 'IMap', 'Record'].includes(value.constructor.name)) {
            value = value.constructor.name + ":" + value.id;
        }
        else if (value instanceof Date) {
            value = value.toISOString();
        }
        */
       
        return SHA256(
            JSON.stringify([
                [...keys].map(([label, node]) => `${label}:${node.id}`).sort(),
                size,
                this.db.encode(value)
            ])
        ).toString('base64');
    }

    get size () {
        if (this.loaded) {
            return this._size;
        }
        else {
            const _self = this;
            return new Promise(async resolve => {
                await _self.load();
                resolve(_self._size);
            });
        }
    }

    set size (value) {
        this._size = value;
    }

    async getNode (data) {
        const {keys, value, size} = data;
        const id = this.getID(keys, value, size);

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
            size: this._size,
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
                else if (this.value instanceof Array) {
                    for (let i=0; i<this.value.length; i++) {
                        const v = this.value[i];

                        if (v instanceof IMap) {
                            v.getWrites(nodes);
                        }
                    }                    
                }
                else if (this.value instanceof Object) {
                    for (let field in this.value) {
                        const v = this.value[field];

                        if (v instanceof IMap) {
                            v.getWrites(nodes);
                        }
                    }
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

    async empty () {
        switch (this.constructor.name) {
            case 'IMap': return this.db.iMap();
            case 'ISet': return this.db.iSet();
            case 'IArray': return this.db.iArray();
        }
    }

    async remove (key) {
        return (await this._remove("" + key)) || this.empty(); // Send empty imap
    }

    async _remove (key, depth=0) {
        await this.load();

        if (depth === key.length) {
            if (this.value !== undefined) {
                if (this.keys._size === 0) {
                    return null;
                }
                
                return this.getNode(
                    {keys: this.keys, size: this._size - 1}
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
                    if (this.keys._size === 1) {
                        return null;
                    }

                    const keys = new Map(this.keys)
                    keys.delete(c);
                    
                    return this.getNode(
                        {
                            keys, 
                            value: this.value,
                            size: this._size - 1
                        }
                    );
                }
                else if (n !== node) {
                    return this.getNode(
                        {
                            keys: new Map(this.keys).set(c,  node), 
                            value: this.value,
                            size: this._size + node._size - n._size
                        }
                    );
                }
            }
        }

        return this;
    }

    get chain () {
        return asyncChain(this);
    }

    async set (key, value, depth=0) {
        await this.load();

        key = '' + key;

        if (depth === key.length) {
            if (this.value !== value) {
                return this.getNode(
                    {keys: this.keys, value, size: this._size + (this.value===undefined?1:0)}
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
                    size: this._size + 1
                });
            }
            else {
                const node = await n.set(key, value, depth+1);

                if (n !== node) {
                    return this.getNode({
                        keys: new Map(this.keys).set(c,  node), 
                        value: this.value,
                        size: this._size + (node._size - n._size)
                    });
                }
            }
        }

        return this;
    }

    async has (label) {
        return (await this.get(label)) !== undefined;
    }

    async get (key, depth=0) {
        await this.load();
        if (depth === key.length) {
            return this.value;
        }
        else {
            key = key.toString();
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

    /*async *keys () {
        for await (let [key] of this) {
            yield key;
        }
    }*/

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

    async toJS () {
        const values = await this.toArray();
        const r = {};
        for (let i=0; i<values.length; i++) {
            const [key, v] = values[i];

            r[key] = v?.toJS?await v.toJS():this.db.encode(v);
        }

        return {
            imap: r,
            leveldbkey: this.db.labelCollection(this.constructor.name, this.id)
        };
    }

    async dump () {
        await this.load();

        const keys = {};
        for (let [key, next] of this.keys) {
            keys[key] = await next.dump();
        }

        return {
            keys,
            size: this._size,
            value: this.db.encode(this.value),
            endoded: this.db.encode(this),
            pretty: this.db.encode(await this.toArray()),
            leveldbkey: this.db.labelCollection(this.constructor.name, this.id)
        }
    };

    get chain () {
        return asyncChain(this);
    }
}

module.exports = IMap;
