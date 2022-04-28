const { expect } = require('chai');
const fc = require('fast-check');
const {DB} = require('../lib/db');

describe('check database types', () => {
    // string text always contains itself
    let db;
    const dbName = 'dbs/basics.db';
    const storage = {
        storage: {
          path: dbName
        }
    };

    beforeEach(async function () {
        db = await DB.open(storage);
    });
    
    afterEach(async function () {
        await db.clear();
        await db.close();
        delete db;
    });

    describe('from memory', () => {
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

    xdescribe('from storage', () => {
        it('should clear database', async () => {
            await db.tables.test.insert({id: 1, test: 'test1'});
            {
                const db3 = await DB.open(storage);
                const record = await db3.tables.test.find(1);
                expect(record.data.test).to.deep.equal('test1');
            }
            
            await db.clear();

            {
                const db3 = await DB.open(storage);
                const record = await db3.tables.test.find(1); 
                expect(record).to.deep.equal(null);
            }
        });

        it('should preserve json types', async () => {
            await fc.assert(fc.asyncProperty(
                fc.jsonValue(),
                async v => {
                    const s = await db.tables.types.insert({type: v});
                    const s2 = await db2.tables.types.find(s.data.id);
                    expect(s2.data.type).to.deep.equal(v);
                }
            ));
        });

        it('should preserve json types, and handle random labels', async () => {
            await fc.assert(fc.asyncProperty(
                fc.string(), fc.jsonValue(),
                async (l, v) => {
                    const s = await db.tables.types.insert({[l]: v});
                    const s2 = await db2.tables.types.find(s.data.id);
                    expect(s2.data[l]).to.deep.equal(v);
                }
            ));
        });

        it('should preserve json types, and handle random labels and tables', async () => {
            await fc.assert(fc.asyncProperty(
                fc.string(), fc.string(), fc.jsonValue(),
                async (t, l, v) => {
                    const s = await db.tables[t].insert({[l]: v});
                    const s2 = await db2.tables[t].find(s.data.id);
                    expect(s2.data[l]).to.deep.equal(v);
                }
            ));
        });
    });
});

