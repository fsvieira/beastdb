const { expect } = require('chai');
const fc = require('fast-check');
const { DB, IMap } = require('../lib/db');

describe('Simple IArray operations', () => {
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

    it('should int elements elements on IArray', async function () {
        return await fc.assert(fc.asyncProperty(
            fc.array(fc.nat()),
            async v => {
                let iarray = await db.iArray();

                for (let i=0; i<v.length; i++) {
                    iarray = await iarray.push(v[i]);
                }

                expect(await iarray.size).to.be.equal(v.length);
                expect(await iarray.length).to.be.equal(v.length);
                expect(await iarray.toArray()).to.be.eql(v);
                
                const s = await db.tables.imaps.insert({
                    iarray
                });

                expect(await s.data.iarray.size).to.be.equal(v.length);
                expect(await s.data.iarray.length).to.be.equal(v.length);
                expect(await s.data.iarray.toArray()).to.be.eql(v);
            }
        ));
    });

    it('should pop int elements on IArray', async function () {
        return await fc.assert(fc.asyncProperty(
            fc.array(fc.nat()),
            async v => {
                let iarray = await db.iArray();

                for (let i=0; i<v.length; i++) {
                    iarray = await iarray.push(v[i]);
                }

                while (v.length > 0) {
                    expect(await iarray.size).to.be.equal(v.length);
                    expect(await iarray.length).to.be.equal(v.length);
                    expect(await iarray.toArray()).to.be.eql(v);

                    const vValue = v.pop();
                    const [array, iValue] = await iarray.pop();
                    iarray = array;
                    expect(iValue).to.be.equal(vValue);
                } 
            }
        ));
    });

});

