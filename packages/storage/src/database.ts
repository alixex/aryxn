import { SqlitePromiser, SqlValue, DbRow } from "./types"

/**
 * 动态导入 SQLite WASM，避免在 SSR 构建时出错
 */
async function loadSqliteInit() {
  const { default: init } = await import("@sqlite.org/sqlite-wasm")
  return init
}

export let dbPromiser: SqlitePromiser | null = null
export let dbId: number | null = null
let initPromise: Promise<void> | null = null

export async function initDatabase(
  onReady?: (dbInstance: any) => Promise<void> | void,
): Promise<void> {
  if (initPromise) return initPromise
  if (dbPromiser && dbId !== null) return

  initPromise = (async () => {
    try {
      if (typeof window === "undefined") {
        throw new Error(
          "SQLite database can only be initialized in browser environment",
        )
      }

      const init = await loadSqliteInit()
      await init()

      const sqlite3Worker1Promiser = globalThis.sqlite3Worker1Promiser
      if (!sqlite3Worker1Promiser) {
        throw new Error("sqlite3Worker1Promiser not found on globalThis")
      }

      dbPromiser = await new Promise((resolve, reject) => {
        const promiser = sqlite3Worker1Promiser({
          onready: () => resolve(promiser),
          onerror: (err: unknown) => {
            console.error("SQLite initialization error:", err)
            reject(err)
          },
        })
      })

      const isCrossOriginIsolated = window.crossOriginIsolated === true
      let openResponse

      if (!dbPromiser) throw new Error("dbPromiser is not initialized")

      try {
        if (isCrossOriginIsolated) {
          openResponse = await dbPromiser("open", {
            filename: "file:aryxn.db?vfs=opfs",
          })
          console.log("SQLite initialized with OPFS (persistent storage)")
        } else {
          openResponse = await dbPromiser("open", {
            filename: ":memory:",
          })
          console.warn(
            "SQLite initialized in memory mode (data not persistent).",
          )
        }
      } catch (opfsError) {
        console.warn(
          "OPFS unavailable, falling back to memory mode:",
          opfsError,
        )
        if (!dbPromiser) throw new Error("dbPromiser is not initialized")
        openResponse = await dbPromiser("open", {
          filename: ":memory:",
        })
      }

      if (openResponse.type === "error") {
        throw new Error(
          `Failed to open database: ${openResponse.message || JSON.stringify(openResponse)}`,
        )
      }

      dbId = openResponse.dbId ?? null

      if (onReady) {
        await onReady(db)
      }

      console.log("Database bridge initialized successfully")
    } catch (error) {
      console.error("Failed to initialize database bridge:", error)
      dbPromiser = null
      dbId = null
      initPromise = null
      throw error
    }
  })()

  return initPromise
}

export async function initializeDatabase(): Promise<void> {
  try {
    await initDatabase()
  } catch (error) {
    console.error("Failed to initialize database:", error)
  }
}

function escapeSqlString(value: SqlValue): string {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "number") return String(value)
  if (typeof value === "boolean") return value ? "1" : "0"
  const str = String(value).replace(/'/g, "''")
  return `'${str}'`
}

async function executeStatement(
  sql: string,
  params: SqlValue[] = [],
  mode: "get" | "all" | "run" = "run",
): Promise<DbRow | DbRow[] | null | void> {
  await initDatabase()
  if (!dbPromiser || dbId === null) throw new Error("Database not initialized")

  let finalSql = sql
  if (params.length > 0) {
    let paramIndex = 0
    finalSql = sql.replace(/\?/g, () => {
      if (paramIndex >= params.length) throw new Error("Not enough parameters")
      const value = params[paramIndex++]
      return escapeSqlString(value)
    })
  }

  try {
    const result = await dbPromiser("exec", {
      dbId,
      sql: finalSql,
      returnValue: mode !== "run" ? "resultRows" : undefined,
      rowMode: mode !== "run" ? "object" : undefined,
    })

    if (result.type === "error") throw new Error(result.message)
    if (mode === "run") return undefined
    if (mode === "get") {
      const rows = result.result?.resultRows || []
      return (rows.length > 0 ? rows[0] : null) as DbRow | null
    }
    return (result.result?.resultRows || []) as DbRow[]
  } catch (error) {
    console.error("SQL execution error:", error)
    throw error
  }
}

export const db = {
  async get(sql: string, params: SqlValue[] = []): Promise<DbRow | null> {
    return (await executeStatement(sql, params, "get")) as DbRow | null
  },
  async all(sql: string, params: SqlValue[] = []): Promise<DbRow[]> {
    return (await executeStatement(sql, params, "all")) as DbRow[]
  },
  async run(sql: string, params: SqlValue[] = []): Promise<void> {
    await executeStatement(sql, params, "run")
  },
  async exec(sql: string): Promise<void> {
    if (!dbPromiser || dbId === null) {
      await initDatabase()
    }
    if (!dbPromiser || dbId === null)
      throw new Error("Database not initialized")
    await dbPromiser("exec", { dbId, sql })
  },
  async beginTransaction(): Promise<void> {
    await this.run("BEGIN TRANSACTION")
  },
  async commit(): Promise<void> {
    await this.run("COMMIT")
  },
  async rollback(): Promise<void> {
    await this.run("ROLLBACK")
  },
  // Clear all application data from the SQLite database and OPFS
  async clearAllData(): Promise<void> {
    await initDatabase()
    if (!dbPromiser || dbId === null)
      throw new Error("Database not initialized")

    const tableDrops = [
      "DROP TABLE IF EXISTS file_indexes_fts",
      "DROP TABLE IF EXISTS file_tags",
      "DROP TABLE IF EXISTS file_indexes",
      "DROP TABLE IF EXISTS folders",
      "DROP TABLE IF EXISTS index_manifests",
      "DROP TABLE IF EXISTS wallets",
      "DROP TABLE IF EXISTS vault_metadata",
    ]

    try {
      for (const sql of tableDrops) {
        try {
          await dbPromiser("exec", { dbId, sql })
        } catch (e) {
          // ignore individual failures and continue
          console.warn(`Failed to drop table with SQL: ${sql}`, e)
        }
      }

      // Attempt to delete the OPFS database file if available
      try {
        const { deleteOpfsDatabaseFile } = await import("./opfs")
        if (typeof deleteOpfsDatabaseFile === "function") {
          await deleteOpfsDatabaseFile()
        }
      } catch (opfsErr) {
        console.warn("Failed to delete OPFS database file:", opfsErr)
      }
    } catch (err) {
      console.error("Failed to clear all data:", err)
      throw err
    }
  },
}
