const { expect } = require('chai');
const fc = require('fast-check');
const { DB, IMap } = require('../lib/db');

describe('remove elements from imap', () => {
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
    });

    afterEach(async function () {
        await db.clear();
        await db.close();
        delete db;
    });

    it('should remove imap one key from size=1 imap', async function () {
        return await fc.assert(fc.asyncProperty(
            fc.jsonValue(),
            async v => {
                const s = await db.tables.imaps.insert({
                    imap: await db.iMap().set('label', v)
                });

                expect(await s.data.imap.size).to.be.equal(1);

                await s.update({ imap: await s.data.imap.remove('label') });
                expect(await s.data.imap.get('label')).to.be.undefined;
                expect(await s.data.imap.size).to.be.equal(0);
            }
        ));
    });

    it('should remove imap key, from size=2 imap', async function () {
        return await fc.assert(fc.asyncProperty(
            fc.jsonValue(), fc.jsonValue(),
            async (v1, v2) => {
                const s = await db.tables.imaps.insert({
                    imap: await db.iMap()
                        .chain
                        .set("label", v1)
                        .set("label2", v2)
                });

                expect(await s.data.imap.size).to.be.equal(2);

                await s.update({ imap: await s.data.imap.remove('label') });
                expect(await s.data.imap.get('label')).to.be.undefined;
                expect(await s.data.imap.get('label2')).to.deep.equal(v2);

                expect(await s.data.imap.size).to.be.equal(1);
            }
        ));
    });

    it('should remove imap one random key from size=1 imap', async () => {
        return await fc.assert(fc.asyncProperty(
            fc.string(), fc.jsonValue(),
            async (l, v) => {
                const s = await db.tables.imaps.insert({
                    imap: await db.iMap().set(l, v)
                });

                expect((await s.data.imap).size).to.be.equal(1);

                await s.update({ imap: await s.data.imap.remove(l) });
                expect(await s.data.imap.get(l)).to.be.undefined;
                expect(await s.data.imap.size).to.be.equal(0);
            }
        ));
    });

    it('should remove imap one random key from size=2 imap', async () => {
        return await fc.assert(fc.asyncProperty(
            fc.string(), fc.jsonValue(), fc.jsonValue(),
            async (l1, v1, v2) => {
                const l2 = l1 + '_2';
                const s = await db.tables.imaps.insert({
                    imap: await db.iMap().chain.set(l1, v1).set(l2, v2)
                });

                expect((await s.data.imap).size).to.be.equal(2);

                await s.update({ imap: await s.data.imap.remove(l1) });
                expect(await s.data.imap.get(l1)).to.be.undefined;
                expect(await s.data.imap.get(l2)).to.deep.equal(v2);
                expect(await s.data.imap.size).to.be.equal(1);
            }
        ));
    });
});

