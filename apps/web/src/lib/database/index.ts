/**
 * Database Layer
 *
 * Export SQLite database utilities and vault-specific database operations.
 */

export {
  deleteOpfsDatabaseFile,
  getOpfsFilesWithSize,
  initDatabase,
  initializeDatabase,
  db,
  initDatabaseWithSchema,
} from "./sqlite-db"
export { initializeVaultDb } from "./vault/db"
export { SCHEMA, INDEXES, FTS_SCHEMA } from "./vault/schema"
export { getStorageInfo } from "./vault/diagnostics"
