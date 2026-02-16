import { useState, useEffect } from "react"
import { useTranslation } from "@/i18n/config"
import { db } from "@/lib/database"
import { clearAllApplicationData } from "@aryxn/storage"
import { toast } from "sonner"
import LanguageSettings from "@/components/settings/LanguageSettings"
import StorageSettingsCard from "@/components/settings/StorageSettingsCard"
import DangerZone from "@/components/settings/DangerZone"

// 格式化字节数为可读格式
function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [storageInfo, setStorageInfo] = useState<{
    quota: number | null
    usage: number | null
    usageDetails: Record<string, number> | null
    opfsFiles: string[]
    opfsFilesWithSize: Array<{ name: string; size: number; path: string }>
    opfsTotalSize: number
    cacheStorageInfo: {
      cacheNames: string[]
      totalEntries: number
      estimatedSize: number
    }
    serviceWorkerInfo: {
      registrations: number
      scopes: string[]
    }
  } | null>(null)
  const [isLoadingStorage, setIsLoadingStorage] = useState(false)

  // Load storage info
  const loadStorageInfo = async () => {
    setIsLoadingStorage(true)
    try {
      const info = await db.getStorageInfo()
      setStorageInfo(info)
    } catch (error) {
      console.error("Failed to load storage info:", error)
      toast.error(
        t("settings.storageInfoError", "Failed to load storage information"),
      )
    } finally {
      setIsLoadingStorage(false)
    }
  }

  useEffect(() => {
    loadStorageInfo()
  }, [])

  const handleClearAllData = async () => {
    setIsClearing(true)
    setShowConfirmDialog(false)

    const timeoutId = setTimeout(() => {
      console.warn("Clear data operation timed out")
      setIsClearing(false)
      setShowConfirmDialog(false)
      toast.error(
        t(
          "settings.clearTimeout",
          "Clear operation timed out. Please try again or refresh the page.",
        ),
      )
    }, 30000)

    try {
      await clearAllApplicationData()

      try {
        const loadInfoPromise = loadStorageInfo()
        const loadInfoTimeout = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Load storage info timeout")),
            5000,
          ),
        )
        await Promise.race([loadInfoPromise, loadInfoTimeout])

        const getInfoPromise = db.getStorageInfo()
        const getInfoTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Get storage info timeout")), 5000),
        )
        const updatedInfo = (await Promise.race([
          getInfoPromise,
          getInfoTimeout,
        ])) as Awaited<ReturnType<typeof db.getStorageInfo>>

        const fileSystemSize = updatedInfo.usageDetails?.fileSystem ?? 0
        const hasLargeFileSystem =
          fileSystemSize > 0 &&
          updatedInfo.opfsTotalSize > 0 &&
          fileSystemSize > updatedInfo.opfsTotalSize * 100

        if (hasLargeFileSystem) {
          toast.success(
            t(
              "settings.clearSuccessWithCacheNote",
              "Application data cleared. Note: Browser HTTP cache ({{size}}) cannot be cleared programmatically. Please clear browser cache manually to free up space.",
              { size: formatBytes(fileSystemSize) },
            ),
            { duration: 5000 },
          )
        } else {
          toast.success(
            t(
              "settings.clearSuccess",
              "All data cleared successfully. The page will refresh shortly.",
            ),
          )
        }
      } catch (infoError) {
        console.warn("Failed to get storage info after clearing:", infoError)
        toast.success(
          t(
            "settings.clearSuccess",
            "All data cleared successfully. The page will refresh shortly.",
          ),
        )
      }

      setIsClearing(false)
      setShowConfirmDialog(false)
      setTimeout(() => window.location.reload(), 2000)
    } catch (error) {
      clearTimeout(timeoutId)

      console.error("Failed to clear data:", error)
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      if (errorMessage.includes("timeout")) {
        toast.error(
          t(
            "settings.clearTimeout",
            "Clear operation timed out. Some data may have been cleared. Please refresh the page.",
          ),
        )
      } else {
        toast.error(
          t("settings.clearError", "Failed to clear data. Please try again."),
        )
      }

      setShowConfirmDialog(false)
      setIsClearing(false)
    } finally {
      setTimeout(() => {
        setIsClearing(false)
        setShowConfirmDialog(false)
      }, 100)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-4 sm:space-y-8 sm:py-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("settings.title", "Settings")}
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          {t("settings.description", "Manage your application settings")}
        </p>
      </div>

      <LanguageSettings />

      <StorageSettingsCard
        storageInfo={storageInfo}
        isLoading={isLoadingStorage}
        onRefresh={loadStorageInfo}
      />

      <DangerZone
        onRequestClear={() => setShowConfirmDialog(true)}
        onConfirmClear={handleClearAllData}
        isClearing={isClearing}
        open={showConfirmDialog}
        setOpen={setShowConfirmDialog}
      />
    </div>
  )
}
