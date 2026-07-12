/*
 * Minimal IndexedDB key-value store for the browser.
 * Replaces the previous SQLite/OPFS layer — lighter, native, no WASM.
 * Source of truth for assets is the chain (Arweave/Irys); this is a local cache.
 */

const DB_NAME = "aryxn"
const STORE = "kv"
const VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"))
      return
    }
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export function idbGet<T = unknown>(key: string): Promise<T | undefined> {
  return tx("readonly", (s) => s.get(key) as IDBRequest<T | undefined>)
}

export function idbSet(key: string, value: unknown): Promise<IDBValidKey> {
  return tx("readwrite", (s) => s.put(value, key))
}

export function idbDel(key: string): Promise<undefined> {
  return tx("readwrite", (s) => s.delete(key) as IDBRequest<undefined>)
}

export function idbKeys(): Promise<IDBValidKey[]> {
  return tx("readonly", (s) => s.getAllKeys())
}

export function idbValues<T = unknown>(): Promise<T[]> {
  return tx("readonly", (s) => s.getAll() as IDBRequest<T[]>)
}

export function idbClear(): Promise<undefined> {
  return tx("readwrite", (s) => s.clear() as IDBRequest<undefined>)
}
