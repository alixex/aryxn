/**
 * SQL 参数值的类型定义
 */
export type SqlValue = string | number | boolean | null | Uint8Array

/**
 * OPFS 文件信息
 */
export interface OpfsFileInfo {
  name: string
  size: number
  path: string
}

/**
 * SQLite Worker API 响应类型
 */
export interface SqliteWorkerResponse {
  type: "success" | "error"
  message?: string
  dbId?: number
  result?: {
    resultRows?: Record<string, SqlValue>[]
    message?: string
  }
  resultRows?: Record<string, SqlValue>[]
}

/**
 * SQLite Worker Promiser 函数类型
 */
export interface SqlitePromiser {
  (
    type: string,
    config?: {
      dbId?: number
      sql?: string
      filename?: string
      returnValue?: string
      rowMode?: string
    },
  ): Promise<SqliteWorkerResponse>
}

export type DbRow = Record<string, SqlValue>

declare global {
  var sqlite3Worker1Promiser:
    | ((config: {
        onready: (promiserFunc: SqlitePromiser) => void
        onerror?: (...args: unknown[]) => void
      }) => SqlitePromiser)
    | undefined
}
