// Data Types:
// JSON, Date, Map, Set, Record, IMap, ISet

import Record from './record.mjs';
import IMap from './imap.mjs';
import ISet from './iset.mjs';
import IArray from './iarray.mjs';
import RecordSnapshot  from './recordSnapshot.mjs';

const type = '_type';
const types = {
    [Date.name]: {
        encode: date => {
            Object.freeze(date);
            return {[type]: Date.name, data: date.toISOString()};
        },
        decode: async ({data}) => Object.freeze(new Date(data)) 
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
    [RecordSnapshot.name]: {
        encode: rs => {
            const data = {};

            for (let field in rs._data) {
                data[field] = encode(rs.data[field]);
            }
    
            return {
                [type]: RecordSnapshot.name,
                record: encode(rs.record),
                data
            }
        },
        decode: async ({record, data}, db) => {
            const sData = await decode(data, db);
            const sRecord = await db.tables[record.data[0]].insert(sData, null);
            
            const s = await sRecord.snapshot(true);
            s.data = {...sData};

            return s;
        }
    },
    [IMap.name]: {
        encode: imap => ({[type]: IMap.name, data: imap.id}),
        decode: async ({data: id}, db) => db.getMemNode(IMap, id, true) 
    },
    [ISet.name]: {
        encode: iset => ({[type]: ISet.name, data: iset.id}),
        decode: async ({data: id}, db) => db.getMemNode(ISet, id, true) 
    },
    [IArray.name]: {
        encode: iarray => ({[type]: IArray.name, data: iarray.id}),
        decode: async ({data: id}, db) => db.getMemNode(IArray, id, true) 
    },
    [Array.name]: {
        encode: array => {
            Object.freeze(array);
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

            Object.freeze(r);
            return r;
        } 
    },
    [Object.name]: {
        encode: obj => {
            Object.freeze(obj);
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

            Object.freeze(r);
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
        else {
            Object.freeze(value);
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
        else {
            Object.freeze(value);
        }
    }

    return value;
}

export {encode, decode};

