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
        db = await DB.open(storage);
    });
    
    afterEach(async function () {
        await db.clear();
        await db.close();
        delete db;
    });


    it('should preserve imap json types', async function () {
        return await fc.assert(fc.asyncProperty(
            fc.jsonValue(),
            async v => {
                const s = await db.tables.imaps.insert({
                    imap: await db.iMap().set('label', v)
                });

                expect(await s.data.imap.get('label')).to.deep.equal(v);
                expect(await s.data.imap.toArray()).to.deep.equal([['label', v]]);
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

                expect(await s.data.imap.get(l)).to.deep.equal(v);
            }
        ));
    });
});

