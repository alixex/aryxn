import { db } from "./database"
import { getOpfsFilesWithSize, deleteOpfsDatabaseFile } from "./opfs"

export async function getStorageInfo() {
  const result = {
    quota: null as number | null,
    usage: null as number | null,
    usageDetails: null as Record<string, number> | null,
    opfsFiles: [] as string[],
    opfsFilesWithSize: [] as any[],
    opfsTotalSize: 0,
    cacheStorageInfo: {
      cacheNames: [] as string[],
      totalEntries: 0,
      estimatedSize: 0,
    },
    serviceWorkerInfo: {
      registrations: 0,
      scopes: [] as string[],
    },
  }

  try {
    if (typeof navigator !== "undefined" && "storage" in navigator) {
      if ("estimate" in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate()
          result.quota = estimate.quota ?? null
          result.usage = estimate.usage ?? null
          const estimateWithDetails = estimate as StorageEstimate & {
            usageDetails?: Record<string, number>
          }
          result.usageDetails = estimateWithDetails.usageDetails ?? null
        } catch (e) {
          console.warn("Storage estimate failed", e)
        }
      }
    }

    result.opfsFilesWithSize = await getOpfsFilesWithSize()
    result.opfsFiles = result.opfsFilesWithSize.map((f) => f.path)
    result.opfsTotalSize = result.opfsFilesWithSize.reduce(
      (acc, f) => acc + f.size,
      0,
    )

    if (typeof caches !== "undefined") {
      try {
        result.cacheStorageInfo.cacheNames = await caches.keys()
      } catch (e) {
        console.warn("Caches keys failed", e)
      }
    }

    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        result.serviceWorkerInfo.registrations = regs.length
        result.serviceWorkerInfo.scopes = regs.map((r) => r.scope)
      } catch (e) {
        console.warn("ServiceWorker registrations failed", e)
      }
    }
  } catch (error) {
    console.warn("Failed to get storage info:", error)
  }

  return result
}

/**
 * Clear application storage across layers:
 * - SQLite tables / OPFS DB file
 * - localStorage / sessionStorage
 * - IndexedDB databases
 * - Service workers (unregister)
 * - Cache Storage
 */
export async function clearAllApplicationData(): Promise<void> {
  // Clear DB first (with a reasonable timeout left to callers)
  try {
    const clearDbPromise = db.clearAllData()
    const clearDbTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database clear timeout")), 15000),
    )
    await Promise.race([clearDbPromise, clearDbTimeout])
  } catch (e) {
    // propagate DB errors to caller
    throw e
  }

  // Browser-level storages
  try {
    if (typeof localStorage !== "undefined") localStorage.clear()
  } catch (e) {
    console.warn("Failed to clear localStorage:", e)
  }

  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.clear()
  } catch (e) {
    console.warn("Failed to clear sessionStorage:", e)
  }

  if (typeof window !== "undefined" && "indexedDB" in window) {
    try {
      const databases = await indexedDB.databases()
      const deletePromises = databases.map(
        (info) =>
          new Promise<void>((resolve) => {
            const req = indexedDB.deleteDatabase(info.name!)
            req.onsuccess = () => resolve()
            req.onerror = () => resolve()
            req.onblocked = () => {
              setTimeout(() => {
                const r = indexedDB.deleteDatabase(info.name!)
                r.onsuccess = () => resolve()
                r.onerror = () => resolve()
              }, 100)
            }
            setTimeout(() => resolve(), 2000)
          }),
      )
      await Promise.race([
        Promise.all(deletePromises),
        new Promise((r) => setTimeout(r, 5000)),
      ])
    } catch (e) {
      console.warn("Failed to clear IndexedDB:", e)
    }
  }

  // Service workers
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const reg of regs) {
        if (reg.active) {
          try {
            reg.active.postMessage({ type: "deregister" })
          } catch {}
        }
      }
      await new Promise((r) => setTimeout(r, 100))
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch (e) {
    console.warn("Failed to unregister Service Workers:", e)
  }

  // Cache storage
  try {
    if (typeof window !== "undefined" && "caches" in window) {
      const cacheNames = await caches.keys()
      for (const cacheName of cacheNames) {
        try {
          const cache = await caches.open(cacheName)
          const keys = await cache.keys()
          await Promise.all(keys.map((k) => cache.delete(k)))
          await caches.delete(cacheName)
        } catch (err) {
          console.warn(`Failed to clear cache ${cacheName}:`, err)
        }
      }
    }
  } catch (e) {
    console.warn("Failed to clear Cache Storage:", e)
  }

  // Attempt OPFS DB file removal as a final step
  try {
    await deleteOpfsDatabaseFile()
  } catch (e) {
    // non-fatal
  }
}
