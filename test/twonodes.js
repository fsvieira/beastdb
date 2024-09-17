"use strict";

const { expect } = require('chai');
const { 
    DB
} = require('../lib/db');

const Remote = require('../adapters/Remote');

/*
const {
    TestComunication,
    TestConnection
} = require('../extensions/TestComunication');
*/



describe('Simple Fetch tests', () => {
    // string text always contains itself

    let dbA, dbB;
    const dbNodeA = 'dbs/nodeA.db';
    const dbNodeB = 'dbs/nodeB.db';
    const storage = (path, remote) => ({
        storage: {
            path
        },
        remote
    });

    beforeEach(async function () {
        // dbA = await DB.open(storage(dbNodeA));
        // dbB = await DB.open(storage(dbNodeB));

        // dbA = new TestComunication(storage(dbNodeA));
        // dbB = new TestComunication(storage(dbNodeB));

        // dbA.connection = new TestConnection(dbB);
        // dbB.connection = new TestConnection(dbA);

        const remoteA = new Remote({remoteFirst: true, remoteLast: true});
        const remoteB = new Remote({remoteFirst: true, remoteLast: true});

        dbA = new DB(storage(dbNodeA, remoteA));
        dbB = new DB(storage(dbNodeB, remoteB));
        
        await dbA.start();
        await dbB.start();

        remoteA.connect(remoteB);

    });

    afterEach(async function () {
        await dbA.clear();
        await dbA.close();
        dbA = null;

        await dbB.clear();
        await dbB.close();
        dbB = null;
    });

    /*
    it('Simple transfer from nodeA to nodeB', async function () {
        // create same array and add it 
        const id = 'testA1';
        const text = 'A test record'

        const recordA = await dbA.tables.test.insert({id, text});

        const recordFromB = await dbB.tables.test.find(id);
        expect(!!recordFromB).to.be.false;

        const recordFromA = await dbB.tables.test._fetch(dbA, id, recordFromB);
        expect(!!recordFromA).to.be.true;
        
        const recordFromB2 = await dbB.tables.test.find(id);
        expect(!!recordFromB2).to.be.true;

        const s = await recordFromB2.snapshot();
        expect(s.data.__version).to.be.eql(1);
        expect(s.data.id).to.be.eql(id);
        expect(s.data.text).to.be.eql(text);
    });*/

    it('Simple transfer from nodeA to nodeB (connection)', async function () {
        const id = 'testA1';
        const text = 'A test record'

        await dbA.tables.test.insert({id, text});

        const recordFromB = await dbB.tables.test.find(id);
        expect(!!recordFromB).to.be.true;

        const s = await recordFromB.snapshot();
        expect(s.data.__version).to.be.eql(1);
        expect(s.data.id).to.be.eql(id);
        expect(s.data.text).to.be.eql(text);
    });

});

