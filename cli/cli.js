const prompt = require('prompt');
prompt.start();

const {DB, ISet, IMap} = require('../lib/db');

async function rawDump(db, query) {
    console.log("LevelDB", query);
    for await (let [key, value] of db.storage.iterator(query)) {
        console.log(`key="${key}", value="${JSON.stringify(value, null, '  ')}"`);
    }
}

async function beastDump(db, tableName, query) {
    console.log("BeastDB", query);
    const table = db.tables[tableName];

    const decodedQuery = await db.decode(query);
    const records = await table.findByIndexArray(decodedQuery);

    for (let i=0; i<records.length; i++) {
        const record = records[i];
        const js = await record.toJS();

        console.log(js);
        console.log(JSON.stringify(js, null, '  '));
    }

}

async function ask (questions) {
    return new Promise((resolve, reject) =>
        prompt.get(questions, function (err, result) {
            if (err) {
                return reject(err);
            }

            resolve(result);
        })
    )
}

async function main (args) {
    console.log(args);

    const dbPath = args[2];
    console.log(dbPath);

    const db = await DB.open({storage: {path: dbPath}});

    for(;;) {
        try {
            const {query: queryString} = await ask(['query']);

            if (queryString === 'end') {
                process.exit();
            }
            else if (queryString.trim().startsWith("key")) {
                const key = queryString.replace("key", "").trim();
                const query = {gte: key, lte: key};

                await rawDump(db, query);
            }
            else if (queryString.trim().startsWith("show")) {
                const obj = JSON.parse(queryString.replace("show", ""));
                const beastObj = await db.decode(obj);

                // console.log(beastObj);
                // console.log(typeof beastObj);
                const js = await beastObj.dump();

                console.log("JS ========>", js);
                console.log(JSON.stringify(js, null, '  '));
            }
            else {
                console.log(queryString);
                const query=queryString===''?undefined:JSON.parse(queryString);

                const table = query?.table;

                if (table) {
                    delete query.table;
                    await beastDump(db, table, query);
                }
                else {
                    await rawDump(db, query);
                }
            }
        }
        catch (e) {
            console.log(e);
        }
    }
}

main(process.argv);
