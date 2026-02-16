# @aryxn/storage

A pure, schema-agnostic SQLite integration with OPFS (Origin Private File System) persistence for Aryxn. This package handles database initialization and file system interactions but does **not** contain specific table definitions.

## Features

- **OPFS Persistence**: Automatically syncs SQLite database to the browser's high-performance private file system.
- **Pure Abstraction**: Provides generic `db` object and SQL execution helpers.
- **Schema-Agnostic**: Allows the application layer to define tables and migrations via `initDatabase`.

## API Reference

| Element                        | Description                                                                                     |
| :----------------------------- | :---------------------------------------------------------------------------------------------- |
| `initDatabase(onReady?)`       | Initializes the SQLite database and OPFS bridge. Accepts an optional callback for schema setup. |
| `db.exec(sql, bind?)`          | Executes a SQL statement (INSERT, UPDATE, DELETE).                                              |
| `db.selectObjects(sql, bind?)` | Executes a SELECT query and returns rows as objects.                                            |
| `db.selectValues(sql, bind?)`  | Executes a SELECT query and returns rows as arrays of values.                                   |
| `listOpfsFiles()`              | Lists all files currently stored in the OPFS.                                                   |

## Usage

```typescript
import { initDatabase, db } from "@aryxn/storage"

// Initialize with a callback to apply schema
await initDatabase(async () => {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)",
  )
})

// Execute queries
const result = await db.selectObjects("SELECT * FROM users")
```
