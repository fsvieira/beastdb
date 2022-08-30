// Data Types:
// JSON, Date, Map, Set, Record, IMap, ISet

const Record = require('./record');
const IMap = require('./imap');
const ISet = require('./iset');

const type = '_type';
const types = {
    [Date.name]: {
        encode: date => ({[type]: Date.name, data: date.toISOString()}),
        decode: async ({data}) => new Date(data) 
    },
    [Map.name]: {
        encode: map => ({[type]: Map.name, data: encode([...map])}),
        decode: async ({data}, db) => new Map(await decode(data, db)) 
    },
    [Set.name]: {
        encode: set => ({[type]: Set.name, data: encode([...set])}),
        decode: async ({data}, db) => new Set(await decode(data, db)) 
    },
    [Record.name]: {
        encode: r => ({[type]: Record.name, data: [r.table.name, r.id]}),
        decode: async ({data: [name, id]}, db) => db.getRecord(await db.tables[name], id)
    },
    [IMap.name]: {
        encode: imap => ({[type]: IMap.name, data: imap.id}),
        decode: async ({data: id}, db) => db.getMemNode(IMap, id, true) 
    },
    [ISet.name]: {
        encode: iset => ({[type]: ISet.name, data: iset.id}),
        decode: async ({data: id}, db) => db.getMemNode(ISet, id, true) 
    },
    [Array.name]: {
        encode: array => {
            const r = [];
            for (let i=0; i<array.length; i++) {
                r.push(encode(array[i]));
            }

            return r;
        },
        decode: async (array, db) => {
            const r = [];
            for (let i=0; i<array.length; i++) {
                r.push(await decode(array[i], db));
            }

            return r;
        } 
    },
    [Object.name]: {
        encode: obj => {
            const r = {};

            for (let key in obj) {
                r[key] = encode(obj[key]);
            }

            return r;
        },
        decode: async (obj, db) => {
            const fn = types[obj._type];
            
            if (fn) {
                return fn.decode(obj, db);
            }

            const r = {};

            for (let key in obj) {
                r[key] = await decode(obj[key], db);
            }

            return r;
        } 
    }
}

function encode (value) {
    if (value) {
        const fn = types[value.constructor.name];

        if (fn) {
            return fn.encode(value);
        }
    }

    return value;
}   

async function decode (value, db) {
    if (value) {
        const fn = types[value.constructor.name];

        if (fn) {
            return fn.decode(value, db);
        }
    }

    return value;
}

module.exports = {encode, decode};

