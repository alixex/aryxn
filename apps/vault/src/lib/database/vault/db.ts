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

    // Run simple migrations for existing tables
    const collectErrorText = (value: unknown): string[] => {
      if (value === null || value === undefined) return []
      if (typeof value === "string") return [value]
      if (typeof value === "number" || typeof value === "boolean") {
        return [String(value)]
      }
      if (Array.isArray(value)) {
        return value.flatMap((entry) => collectErrorText(entry))
      }
      if (typeof value === "object") {
        const objectValues = Object.values(value as Record<string, unknown>)
        return objectValues.flatMap((entry) => collectErrorText(entry))
      }
      return [String(value)]
    }

    const isDuplicateColumnError = (error: unknown, column: string) => {
      const combined = collectErrorText(error).join(" | ").toLowerCase()
      const lowerColumn = column.toLowerCase()

      return (
        combined.includes("duplicate column name") ||
        (combined.includes("already exists") && combined.includes(lowerColumn))
      )
    }

    const migrations = [
      {
        sql: "ALTER TABLE bridge_transactions ADD COLUMN user_address TEXT",
        column: "user_address",
      },
      {
        sql: "ALTER TABLE resource_cache ADD COLUMN cache_backend TEXT NOT NULL DEFAULT 'db_base64'",
        column: "cache_backend",
      },
      {
        sql: "ALTER TABLE resource_cache ADD COLUMN opfs_key TEXT",
        column: "opfs_key",
      },
    ]

    for (const migration of migrations) {
      try {
        await db.exec(migration.sql)
      } catch (e) {
        if (isDuplicateColumnError(e, migration.column)) {
          continue
        }
        console.error(`Failed to migrate: ${migration.sql}`, e)
      }
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
