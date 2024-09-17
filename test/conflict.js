"use strict";

const { expect } = require('chai');
const { 
    DB, 
    Exceptions: {
        RecordUpdateConflictException
    }
} = require('../lib/db');

describe('Simple Conflict tests', () => {
    // string text always contains itself

    let db;
    const dbName = 'dbs/conflict.db';
    const storage = {
        storage: {
            path: dbName
        }
    };

    beforeEach(async function () {
        // db = await DB.open(storage)
        db = new DB(storage);
        await db.start();
    });

    afterEach(async function () {
        await db.clear();
        await db.close();
        db = null;
    });

    it('should be able to handle conflicts', async function () {
        // create same array and add it 
        let myset = db.iSet();

        const record = await db.tables.mySets.insert({
            myset,
            test: [{deep: {freeze: true }}, {deep: {freeze: true }}]
        });

        const dataA = await record.snapshot();
        const dataB = await record.snapshot();


        expect(() => dataA.data.test[1].deep.freeze = false).to.throw(
            "Cannot assign to read only property 'freeze' of object '#<Object>'"
        );

        expect(dataA.data.test[1].deep.freeze).to.be.eql(true);

        dataA.data.myset = await dataA.data.myset.add(1);

        await dataA.update();

        dataB.data.myset = await dataB.data.myset.add(2);

        // await record.update(dataA);

        try {
            await dataB.update();
        }
        catch (e) {
            if (e instanceof RecordUpdateConflictException) {
                const mergedData = await record.snapshot();
                
                for await (let e of await dataB.data.myset.values()) {
                    mergedData.data.myset = await mergedData.data.myset.add(e);
                }

                await mergedData.update();
            }
        }

        const result = await record.data.myset.toArray();
        expect(result).to.be.eql([1, 2]);

    });
});

