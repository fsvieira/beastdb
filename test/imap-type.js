const { expect } = require('chai');
const fc = require('fast-check');
const {DB, IMap} = require('../lib/db');

describe('check database imap types', () => {
    // string text always contains itself

    let db;
    const dbName = 'dbs/basics.db';
    const storage = {
        storage: {
          path: dbName
        }
    };

    beforeEach(async function () {
        db = await DB.open(storage)
        await db.tables.imaps
            .type('imap', IMap)
            .save();
    });
    
    afterEach(async function () {
        await db.clear();
        await db.close();
        delete db;
    });

    describe('from memory', () => {
        it('should preserve imap json types', async function () {
            return await fc.assert(fc.asyncProperty(
                fc.jsonValue(),
                async v => {
                    const s = await db.tables.imaps.insert({
                        imap: await db.iMap().set('label', v)
                    });

                    expect(await (await s.data.imap).get('label')).to.deep.equal(v);
                    expect(await (await s.data.imap).toArray()).to.deep.equal([['label', v]]);
                }
            ));
        });

        it('should preserve imap json types, and handle random labels', async () => {
            return await fc.assert(fc.asyncProperty(
                fc.string(), fc.jsonValue(),
                async (l, v) => {
                    const s = await db.tables.imaps.insert({
                        imap: await db.iMap().set(l, v)
                    });

                    expect(await (await s.data.imap).get(l)).to.deep.equal(v);
                }
            ));
        });
    });

    xdescribe('from storage', () => {
        it('should preserve json types', async function () {
            this.timeout(Infinity);
            await fc.assert(fc.asyncProperty(
                fc.jsonValue(),
                async v => {
                    const s = await db.tables.imaps.insert({
                        imap: await db.iMap().set('label', v)
                    });

                    await db.close();
                    
                    db = await DB.open(storage);
                    const s2 = await db.tables.imaps.find(s.data.id);
                    expect(await (await s2.data.imap).get('label')).to.deep.equal(v);
                }
            ));
        });

        xit('should preserve json types, and handle random labels', async () => {
            await fc.assert(fc.asyncProperty(
                fc.string(), fc.jsonValue(),
                async (l, v) => {
                    const db = await createDB();
                    const s = await db.tables.imaps.insert({
                        imap: await db.iMap().set(l, v)
                    });

                    await closeDB(db);

                    const db2 = await openDB();
                    const s2 = await db2.tables.imaps.find(s.data.id);
                    expect(await (await s2.data.imap).get(l)).to.deep.equal(v);

                    await clearDB(db2);
                }
            ));
        });
    });
});

