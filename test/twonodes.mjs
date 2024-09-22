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

