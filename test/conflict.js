const { expect } = require('chai');
const { DB } = require('../lib/db');

const Record = require('../lib/record');

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
        db = await DB.open(storage)
    });

    afterEach(async function () {
        await db.clear();
        await db.close();
        delete db;
    });

    it('should be able to handle conflicts', async function () {
        // create same array and add it 
        let myset = db.iSet();

        const record = await db.tables.mySets.insert({
            myset
        });

        const dataA = {
            myset: await record.data.myset,
            __version: await record.data.__version,
            __hashHistory: await record.data.__hashHistory
        };

        const dataB = {
            myset: await record.data.myset,
            __version: await record.data.__version,
            __hashHistory: await record.data.__hashHistory
        };

        dataA.myset = await dataA.myset.add(1);
        dataB.myset = await dataB.myset.add(2);

        await record.update(dataA);

        try {
            await record.update(dataB);
        }
        catch (e) {
            if (e instanceof Record.Exception.UpdateConflict) {
                const mergedData = {
                    __version: await record.data.__version,
                    __hashHistory: await record.data.__hashHistory,
                    myset: await record.data.myset
                };
                
                for await (let e of await dataB.myset.values()) {
                    mergedData.myset = await mergedData.myset.add(e);
                }

                await record.update(mergedData);

                const result = await record.data.myset.toArray();

                expect(result).to.be.eql([1, 2]);
            }
        }

    });
});

