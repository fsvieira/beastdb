const { expect } = require('chai');
const fc = require('fast-check');
const {DB} = require('../lib/db');
const LevelDBStorage = require('../storage/levelDBStorage');

describe('check database types', () => {
    // string text always contains itself
    let db;
    // const dbName = 'dbs/basics.db';
    /*
    const storage = {
        storage: {
          path: dbName
        }
    };*/

    beforeEach(async function () {
        db = await DB.open(new LevelDBStorage({dbsPath: 'dbs', dbname: 'basics.db'}));
    });
    
    afterEach(async function () {
        await db.clear();
        await db.close();
        delete db;
    });

    it('should preserve json types', async () => {
        await fc.assert(fc.asyncProperty(
            fc.jsonValue(),
            async v => {
                const s = await db.tables.types.insert({type: v});
                expect(await s.data.type).to.deep.equal(v);
            }
        ));
    });

    it('should preserve json types, and handle random labels', async () => {
        await fc.assert(fc.asyncProperty(
            fc.string(), fc.jsonValue(),
            async (l, v) => {
                const s = await db.tables.types.insert({[l]: v});
                expect(await s.data[l]).to.deep.equal(v);
            }
        ));
    });

    it('should preserve json types, and handle random labels and tables', async () => {
        await fc.assert(fc.asyncProperty(
            fc.string(), fc.string(), fc.jsonValue(),
            async (t, l, v) => {
                const s = await db.tables[t].insert({[l]: v});
                expect(await s.data[l]).to.deep.equal(v);
            }
        ));
    });
});

