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
 * key and indexes
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

This will allows to query state alone and win and state togheter.




# Example

# API

## 

# The Name
The name beast derives from brute-force and was chosen as a synonym of brute.


