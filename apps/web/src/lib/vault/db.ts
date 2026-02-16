import { initDatabase, db as storageDb } from "@aryxn/storage"
import { SCHEMA, INDEXES, FTS_SCHEMA } from "./schema"

/**
 * Initialize the Aryxn database with the required schema.
 */
export async function initializeVaultDb() {
  return initDatabase(async (db) => {
    // Apply schema
    for (const sql of SCHEMA) {
      await db.exec(sql)
    }

    // Apply indexes
    for (const sql of INDEXES) {
      try {
        await db.exec(sql)
      } catch (e) {
        console.error(`Failed to create index: ${sql}`, e)
      }
    }

    // Apply FTS
    try {
      await db.exec(FTS_SCHEMA)
    } catch (e) {
      console.warn("Failed to create FTS5 index (optional):", e)
    }
  })
}

/**
 * The Aryxn-specific db object.
 * It ensures the database is initialized before any operations.
 */
export const db = {
  ...storageDb,
  async get(sql: string, params: any[] = []) {
    await initializeVaultDb()
    return storageDb.get(sql, params)
  },
  async all(sql: string, params: any[] = []) {
    await initializeVaultDb()
    return storageDb.all(sql, params)
  },
  async run(sql: string, params: any[] = []) {
    await initializeVaultDb()
    return storageDb.run(sql, params)
  },
  async exec(sql: string) {
    await initializeVaultDb()
    return storageDb.exec(sql)
  },
}
