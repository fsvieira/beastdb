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

                const win = await isWin(turn, newGame);

                childs.add(
                    await t.insert({
                        moves: (await state.data.moves) + 1,
                        state: win ? 'done' : 'expand',
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

    for await (let [y, line] of game) {
        for await (let [x, cell] of line) {
            board += `${cell} `;
        }

        board+= '\n';
    }

    console.log(`=====\n turn: ${turn}, moves: ${moves}\n -- \n`, board);
}

async function tictactoe () {
    const db = await DB.open({storage: {path: './tttdb'}});

    const t = await db.tables.tictactoe
        .key('stateID', ['game', 'turn', 'moves'])
        .index('state')
        .index('win')
        .save();

    const start = await t.insert({
        moves: 0,
        state: 'expand',
        turn: '',
        childs: [],
        game: await db.iMap().fromJSON([
            ['#', '#', '#'],
            ['#', '#', '#'],
            ['#', '#', '#']
        ])
    }, null);

    let doExpand;

    console.log('Start State', await start.data.state);

    let totalNodes = 0;
    do {
        doExpand = false;
        let lastMoves = -1;
        for await (let state of t.findByIndex({state: 'expand'})) {
            const moves = await state.data.moves;
            if (moves !== lastMoves) {
                lastMoves = moves;
                console.log("Expand: " + moves);
            }

            totalNodes++;
            await expand(t, state);
            doExpand = true;
        }
    } while(doExpand)

    const wins = {}
    let winNode;
    for await (let state of t.findByIndex({win: true})) {
        const turn = await state.data.turn;
        wins[turn] = (wins[turn] || 0) + 1; 
        await print(state);
        winNode = state;
    }


    console.log("Generated ", totalNodes, " states!");
    console.log(JSON.stringify(wins));

    const parents = await winNode.data.parents;

    console.log("-- Last Win Node --");
    await print(winNode);

    console.log("List Last Win Node Parents");
    for (let s of parents) {
        await print(s);
    }
}

tictactoe();