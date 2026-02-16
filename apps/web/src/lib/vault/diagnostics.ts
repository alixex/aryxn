import { getOpfsFilesWithSize } from "@aryxn/storage"

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
