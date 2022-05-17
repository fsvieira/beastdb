const { expect } = require('chai');
const { statistics } = require('fast-check');
const {DB, ISet, IMap} = require('../lib/db');

describe('Tic-tac-toe cases', () => {
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
        const t = await db.tables.tictactoe
            .key('stateID', ['game', 'turn', 'moves'])
            .index('state')
            .index('moves')
            .save();

        await t.insert({
            moves: 0,
            state: 'expand',
            turn: '',
            childs: await db.iSet(),
            game: await db.iMap().fromJSON([
                ['#', '#', '#'],
                ['#', '#', '#'],
                ['#', '#', '#']
            ])
        });
    });
    
    afterEach(async function () {
        await db.clear();
        await db.close();
        delete db;
    });

    describe('Test Game States', () => {
        it('should have same id for the same content.', async () => {
            const t = await db.tables.tictactoe;
            const [start] = await t.findByIndexArray({moves: 0});
            const game = await start.data.game;
            expect(await game.chain.get('0').id).to.deep.equal(await game.chain.get('1').id);
            expect(await game.chain.get('0').get('0')).to.deep.equal('#');
        });

        it('should generate same primary key for same states.', async () => {
            const t = await db.tables.tictactoe;

            const r1 = await t.insert({
                moves: 3,
                turn: 'X',
                state: 'expand',
                game: await db.iMap().fromJSON([
                    ['X', '#', '#'],
                    ['#', 'O', '#'],
                    ['#', '#', 'X']
                ])
            });

            const r2 = await t.insert({
                moves: 3,
                turn: 'X',
                state: 'expand',
                game: await db.iMap().fromJSON([
                    ['X', '#', '#'],
                    ['#', 'O', '#'],
                    ['#', '#', 'X']
                ])
            }, null); // null is the same has insert ignore.

            expect(await r1.data.state).to.deep.equal('expand');

            expect(r1.id).to.deep.equal(r2.id);

            /* Only works with chai-promise ?
            expect(await t.insert({
                    moves: 3,
                    turn: 'X',
                    state: 'expand',
                    game: await db.iMap().fromJSON([
                        ['X', '#', '#'],
                        ['#', 'O', '#'],
                        ['#', '#', 'X']
                    ])
                })
            ).to.be.rejectedWith("Duplicated record 0j42vSMlXJaNSltCe5QRnW/tfwEmkZYRZuIuvFsF4Os= on table tictactoe!")
            */ 

            expect(await t.insert({
                moves: 3,
                turn: 'X',
                state: 'expand',
                game: await db.iMap().fromJSON([
                    ['X', '#', '#'],
                    ['#', 'O', '#'],
                    ['#', '#', 'X']
                ])
            }, {state: 'end'}));

            expect(await r1.data.state).to.deep.equal('end');

        });

        it('should generate intermediate states.', async () => {
            const t = await db.tables.tictactoe;
            const [start] = await t.findByIndexArray({moves: 0});

            const setCell = async (s, x, y, xo) => {
                x = '' + x;
                y = '' + y;

                const board = await s.data.game;
                const line = await board.get(y);
    
                return await board.set(y, await line.set(x, xo))
            }

            const a1 = await t.insert({
                moves: 3,
                turn: 'X',
                state: 'expand',
                game: await setCell(start, 0, 0, 'X')
            });

            const a2 = await t.insert({
                moves: 3,
                turn: 'X',
                state: 'expand',
                game: await setCell(a1, 1, 1, 'O')
            });

            const a3 = await t.insert({
                moves: 3,
                turn: 'X',
                state: 'expand',
                game: await setCell(a2, 2, 2, 'X')
            });


            const b1 = await t.insert({
                moves: 3,
                turn: 'X',
                state: 'expand',
                game: await setCell(start, 2, 2, 'X')
            });

            const b2 = await t.insert({
                moves: 3,
                turn: 'X',
                state: 'expand',
                game: await setCell(b1, 1, 1, 'O')
            });

            const b3 = await t.insert({
                moves: 3,
                turn: 'X',
                state: 'expand',
                game: await setCell(b2, 0, 0, 'X')
            }, null);


            expect(a1.id).to.not.equal(b1.id);
            expect(a2.id).to.not.equal(b2.id);
            expect(a3.id).to.equal(b3.id);
        });

        it('should save and acess childs.', async () => {
            const t = await db.tables.tictactoe;
            const [start] = await t.findByIndexArray({moves: 0});

            const s = await t.insert({
                moves: 3,
                turn: 'X',
                state: 'expand',
                game: await db.iMap().fromJSON([
                    ['X', '#', '#'],
                    ['#', 'O', '#'],
                    ['#', '#', 'X']
                ])
            });

            start.update({childs: await start.data.childs.add(s)});

            const childs = (await start.data.childs.toArray()).map(node => node.id);
            
            expect(childs).to.deep.equal(["KRyCYmdM5hf2KKV1BuD/hBdxp+nbrUPgJX1L7LKw5MU="]);
        });
    });
});

