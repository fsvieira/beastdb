const {DB, ISet, IMap} = require('../../lib/db');

async function isWin(turn, game) {
    // check lines: 
    for (let x=0; x<3; x++) {
        let win = true;

        for (let y=0; y<3; y++) {
            const c = (await (await game.get('' + y)).get('' + x));

            if (c !== turn) {
                win = false;
                break;
            }
        }

        if (win) {return true}
    }

    for (let y=0; y<3; y++) {
        let win = true;

        for (let x=0; x<3; x++) {
            const c = (await (await game.get('' + y)).get('' + x));

            if (c !== turn) {
                win = false;
                break;
            }
        }

        if (win) {return true}
    }


    return (
        ((await (await game.get('0')).get('0')) === turn) &&
        ((await (await game.get('1')).get('1')) === turn) &&
        ((await (await game.get('2')).get('2')) === turn) 
    )
    || (
        ((await (await game.get('0')).get('2')) === turn) &&
        ((await (await game.get('1')).get('1')) === turn) &&
        ((await (await game.get('2')).get('0')) === turn)
    )
}

async function expand (t, state) {
    const turn = (await state.data.turn) === 'X' ? 'O' : 'X';
    const game = await state.data.game;

    const childs = new Set();
    for await (let [y, line] of game) {
        for await (let [x, cell] of line) {
            if (cell === '#') {
                const newGame = (await game.set(y, await line.set(x, turn)));

                const didWin = await isWin(turn, newGame);

                const moves = (await state.data.moves) + 1;
                let win = didWin?turn:(moves === 9?'T':'');
                
                childs.add(
                    await t.insert({
                        moves,
                        state: win === '' ? 'expand' : 'stats',
                        turn,
                        win,
                        game: newGame,
                        parents: new Set([state])
                    }, async r => r.update({parents: (await r.data.parents).add(state)}))
                );
            }
        }
    }

    await state.update({childs, state: 'done'});
}

async function print (state) {
    let board = "";

    const turn = await state.data.turn;
    const moves = await state.data.moves;
    const game = await state.data.game;
    const stats = await state.data.stats;

    for await (let [y, line] of game) {
        for await (let [x, cell] of line) {
            board += `${cell} `;
        }

        board+= '\n';
    }

    console.log(`Turn: ${turn},\n Moves: ${moves},\nStats: ${JSON.stringify(stats)},\n${board}\n`);
}

async function calcStatsTurn (t, turn) {
    console.log(`-- Gen ${turn} Stats`);

    for await (let state of t.findByIndex({win: turn, state: 'stats'})) {
        await state.update({stats: {X: 0, T: 0, O: 0, [turn]: 1}, state: 'done'});

        const stack = [...(await state.data.parents)];
        do {            
            const parent = stack.pop();
            const stats = (await parent.data.stats) || {X:0, T:0, O: 0};

            await parent.update({
                stats: {...stats, [turn]: (stats[turn] || 0) + 1},
                state: 'done'
            });

            const parents = await parent.data.parents;
            if (parents) {
                stack.push(...parents);
            }

            // console.log("Stack", stack.length);
        }
        while (stack.length);
    }

    console.log(`-- End ${turn} Stats`);
}


async function calcStats (t) {

    // get X win nodes,
    await calcStatsTurn(t, 'X');
    await calcStatsTurn(t, 'T');
    await calcStatsTurn(t, 'O');
}

async function tictactoe () {
    const db = await DB.open({storage: {path: './tttdb'}});

    const t = await db.tables.tictactoe
        .key('stateID', ['game', 'turn', 'moves'])
        .index('state')
        .index('win', 'state')
        .index('game')
        .save();

    await t.insert({
        moves: 0,
        state: 'expand',
        turn: '',
        childs: [],
        game: await db.iMap().chain
            .set(0, await db.iMap().chain.set(0, '#').set(1, '#').set(2, '#'))
            .set(1, await db.iMap().chain.set(0, '#').set(1, '#').set(2, '#'))
            .set(2, await db.iMap().chain.set(0, '#').set(1, '#').set(2, '#'))
    }, null);

    let doExpand;

    // expand all states
    do {
        doExpand = false;
        let lastMoves = -1;
        for await (let state of t.findByIndex({state: 'expand'})) {
            const moves = await state.data.moves;
            if (moves !== lastMoves) {
                lastMoves = moves;
                console.log("Expand: " + moves);
            }

            await expand(t, state);
            doExpand = true;
        }
    } while(doExpand)

    // TODO: calcStats seems to have a problem :/
    // await calcStats(t);

    // find game state
    const gameState = await db.iMap().chain
        .set(0, await db.iMap().chain.set(0, 'X').set(1, '#').set(2, 'O'))
        .set(1, await db.iMap().chain.set(0, '#').set(1, 'O').set(2, 'O'))
        .set(2, await db.iMap().chain.set(0, 'X').set(1, '#').set(2, 'X'))
    ;

    for await (let state of t.findByIndex({game: gameState})) {
        const childs = await state.data.childs;

        for (let child of childs) {
            print(child);
        }
    }
}

tictactoe();