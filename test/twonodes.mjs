"use strict";

import { expect } from 'chai';
import { BeastDB } from '../lib/beastDB.mjs';

import RemoteDummy from '../adapters/RemoteDummy.mjs';

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
        const remoteA = new RemoteDummy({remoteFirst: true, remoteLast: true});
        const remoteB = new RemoteDummy({remoteFirst: true, remoteLast: true});

        dbA = new BeastDB(storage(dbNodeA, remoteA));
        dbB = new BeastDB(storage(dbNodeB, remoteB));
        
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

    xit('Simple transfer from nodeA to nodeB (connection)', async function () {
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

    it('Simple transfer from nodeA to nodeB (with update)', async function () {
        const text = 'A - TODO';

        await dbA.tables.todos.key('todoID').index('done').save();
        await dbB.tables.todos.key('todoID').index('done').save();

        const recordA = await dbA.tables.todos.insert({text, done: false});
        const hashesA1 = await recordA.data.__hashHistory;

        // await new Promise(resolve => setTimeout(resolve, 100 * 5));

        const recordB = await dbB.tables.todos.find(recordA.id);

        const hashesB1 = await recordB.data.__hashHistory;
        expect(hashesB1).to.be.eql(hashesA1);

        const s = await recordA.snapshot();
        s.data.done = true;
        await s.update();

        // wait for things to propagate
        await new Promise(resolve => setTimeout(resolve, 100 * 5));

        const hashesA2 = await recordA.data.__hashHistory;

        const hashesB2 = await recordB.data.__hashHistory;

        console.log(' A ==>', hashesA1, hashesA2);
        console.log(' B ==>', hashesB1, hashesB2);
        
    });

});

