# beastDB
A persistence database specializing in state space search problems!

# Overview

BeastDB purpose is to help model, consult and persiste states in a eficience way, 
it does this by using leveldb as storage and introducing two immutable data 
types ISet and IMap.

ISet and IMap are implemented using immutable structural sharing, making copy and 
change operations very fast and memory eficient and strutural sharing representation 
is preserved on storage, making it very fast to load and save states.

This is the main diference bettwen BeastDB and other databases, but its not the only one:
 
 * Create Database
 * Tables, key and indexes
 * Records
 * Types
 * Query

## Create Database

To create a database just pass the storage option with a path.

```javascript
  const db = await DB.open({storage: {path: './tttdb'}});
```

## Tables, key and indexes
 
Tables are created on the fly like this:

```javascript
  const t = db.tables.tictactoe;
```

Key and indexes are optional, but they need to created on start.

```javascript
  const t = await db.tables.tictactoe
    .key('stateID', ['game', 'turn', 'moves'])
    .index('state')
    .index('win', 'state')
    .index('game')
    .save();
```

After creating key and index we must call save to storage changes.

### key
  There is only one key per table, on a SQL database this would be a primary key.
  A key is unique and immutable, when creating a compound key all fields in the key are not allowed to change.

  If a key is not provided then table would use id has primary key, and uuid is used as a key generator.
  
  If a key is provided with no fields then key name is used as primary key and uuid is used as a key generator, ex.

```javascript
    t.key('stateID')
```

### Indexes
 Indexes can have one or more fields, and rigth now you can't make queries without them, ex.
 
```javascript
  t.index('state')
  .index('win', 'state')
```

This allows us to query 'state' alone and 'win' and 'state' togheter.

## Records

To create and update records we use insert and update operations.
There is no restriction to add fields on insert or update.

### Insert
 Insert takes two arguments the record and on conflict strategy:

```javascript
    const record = await t.insert({
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
```


   * null : ignore if alredy exists,
   * object: on conflict update with object data, ex:
```javascript
    const record = await t.insert({
        moves: 0,
        state: 'expand',
        turn: '',
        childs: [],
        game: await db.iMap().fromJSON([
            ['#', '#', '#'],
            ['#', '#', '#'],
            ['#', '#', '#']
        ])
    }, {state: 'existing');
```
   * async function (oldData, newData) {t.update(...)} : a function to solve the conflict  
 
### Update
  After a record is created it can be updated like this:

```javascript
    await record.update({
       state: 'done', myNewField: 'do it'
    });
```

  Updates can't contain any field of primary key.

## Types

Records only suport this types of values,

### Record

A record can have other records as value, this can be from the same table or from another table, ex:

```javascript
    await record.update({
       parent: await db.tables.myOtherTable.insert({'doit': 'now'})
    });
```

It can even be recursive:

```javascript
    await record.update({
       self: record
    });
```

### Date, Map, Set

Javascript Date, Map and Set is accepted.

Map and Set can have any value of the types described in this section, ex.

```javascript
    await record.insert({
       map: new Set([new Date(), record, 1, 'string', ...])
    });
```


### JSON

Any json value like number, string, object, array ...

Objects and Arrays can be nested and can have any type of value described on this section, ex:

```javascript
    await record.insert({
       o: {
          date: new Date(),
          records: [record1, record2],
          mySet: new Set([1, 2, 3])
       }    
    });
```

### IMap and ISet

IMap and ISet are immutable so every write operation will return a new IMap or ISet. 

#### IMap

TODO

#### ISet

TODO

# Example

TODO

## 

# The Name
The name beast derives from brute-force and was chosen as a synonym of brute.


