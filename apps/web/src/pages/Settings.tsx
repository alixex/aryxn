import { useState, useEffect } from "react"
import { useTranslation } from "@/i18n/config"
import { db } from "@/lib/sqlite-db"
import { toast } from "sonner"
import {
  Trash2,
  AlertTriangle,
  RefreshCw,
  Globe,
  HardDrive,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { LanguageSwitcher } from "@/components/language-switcher"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// 格式化字节数为可读格式
function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// 计算百分比
function calculatePercentage(
  usage: number | null,
  quota: number | null,
): number {
  if (!usage || !quota) return 0
  return Math.round((usage / quota) * 100)
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

  // 加载存储信息
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

  // 组件加载时获取存储信息
  useEffect(() => {
    loadStorageInfo()
  }, [])

  const handleClearAllData = async () => {
    setIsClearing(true)
    setShowConfirmDialog(false) // 立即关闭对话框，避免用户重复点击

    // 添加超时保护，防止操作卡住
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
    }, 30000) // 30 秒超时（减少超时时间）

    try {
      // 1. 清除 SQLite 数据库中的所有数据（包括删除数据库文件）
      // 添加超时保护，防止 clearAllData 卡住
      const clearDbPromise = db.clearAllData()
      const clearDbTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database clear timeout")), 15000),
      )
      await Promise.race([clearDbPromise, clearDbTimeout])

      // 2. 清除 localStorage 中的所有数据
      localStorage.clear()

      // 3. 清除 sessionStorage
      sessionStorage.clear()

      // 4. 清除 IndexedDB（如果有的话）
      if (typeof window !== "undefined" && "indexedDB" in window) {
        try {
          // 尝试删除所有 IndexedDB 数据库，添加超时保护
          const databasesPromise = indexedDB.databases()
          const databasesTimeout = new Promise<IDBDatabaseInfo[]>((_, reject) =>
            setTimeout(() => reject(new Error("IndexedDB list timeout")), 5000),
          )
          const databases = await Promise.race([
            databasesPromise,
            databasesTimeout,
          ])

          const deletePromises = databases.map((db) => {
            return new Promise<void>((resolve) => {
              const deleteReq = indexedDB.deleteDatabase(db.name!)
              deleteReq.onsuccess = () => resolve()
              deleteReq.onerror = () => resolve() // 忽略错误，继续
              deleteReq.onblocked = () => {
                // 如果被阻塞，等待一下再重试
                setTimeout(() => {
                  const retryReq = indexedDB.deleteDatabase(db.name!)
                  retryReq.onsuccess = () => resolve()
                  retryReq.onerror = () => resolve() // 忽略错误，继续
                }, 100)
              }
              // 添加超时保护
              setTimeout(() => resolve(), 2000)
            })
          })
          await Promise.race([
            Promise.all(deletePromises),
            new Promise((resolve) => setTimeout(resolve, 5000)),
          ])
        } catch (indexedDbError) {
          console.warn("Failed to clear IndexedDB:", indexedDbError)
          // 不抛出错误，继续执行
        }
      }

      // 5. 取消注册所有 Service Worker（先取消注册，再清除缓存）
      // 这样可以确保 Service Worker 不会继续拦截请求
      try {
        if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations()

          // 先发送消息让 Service Worker 停止工作
          for (const registration of registrations) {
            if (registration.active) {
              try {
                registration.active.postMessage({ type: "deregister" })
              } catch {
                // 忽略错误
              }
            }
          }

          // 等待一下，让 Service Worker 处理消息
          await new Promise((resolve) => setTimeout(resolve, 100))

          // 取消注册所有 Service Worker
          await Promise.all(
            registrations.map((registration) => registration.unregister()),
          )
        }
      } catch (swError) {
        console.warn("Failed to unregister Service Workers:", swError)
      }

      // 6. 清除 Cache Storage（Service Worker 缓存）
      // 注意：必须在取消注册 Service Worker 之后清除缓存
      if (typeof window !== "undefined" && "caches" in window) {
        try {
          const cacheNames = await caches.keys()
          console.log("Clearing caches:", cacheNames)

          // 清除每个缓存中的所有条目
          for (const cacheName of cacheNames) {
            try {
              const cache = await caches.open(cacheName)
              const keys = await cache.keys()
              console.log(`Cache ${cacheName} has ${keys.length} entries`)

              // 删除缓存中的所有条目
              await Promise.all(keys.map((key) => cache.delete(key)))

              // 删除缓存本身
              await caches.delete(cacheName)
            } catch (cacheError) {
              console.warn(`Failed to clear cache ${cacheName}:`, cacheError)
            }
          }
        } catch (cacheError) {
          console.warn("Failed to clear Cache Storage:", cacheError)
          // 不抛出错误，继续执行
        }
      }

      // 7. 尝试清除所有可能的存储
      // 注意：浏览器的 HTTP 缓存（fileSystem 中的大部分数据）无法通过 JavaScript 清除
      // 需要用户手动清除浏览器缓存
      try {
        // 尝试清除所有可能的存储配额
        // 这可能会触发浏览器清理一些临时数据
        if (
          typeof navigator !== "undefined" &&
          "storage" in navigator &&
          "persist" in navigator.storage
        ) {
          // 检查持久化权限
          const isPersisted = await navigator.storage.persist()
          console.log("Storage persisted:", isPersisted)
        }

        // 尝试请求持久化存储（可能会触发清理）
        if (
          typeof navigator !== "undefined" &&
          "storage" in navigator &&
          "persist" in navigator.storage
        ) {
          try {
            await navigator.storage.persist()
          } catch {
            // 忽略错误
          }
        }
      } catch (storageError) {
        console.warn("Failed to manage storage:", storageError)
      }

      // 等待一下，让删除操作完成
      await new Promise((resolve) => setTimeout(resolve, 500))

      // 清除超时保护
      clearTimeout(timeoutId)

      // 尝试刷新存储信息（在页面刷新前），但如果失败也不影响清除操作
      // 添加超时保护，防止 getStorageInfo 卡住
      let hasLargeFileSystem = false
      let fileSystemSize = 0
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
        fileSystemSize = updatedInfo.usageDetails?.fileSystem ?? 0
        hasLargeFileSystem =
          fileSystemSize > 0 &&
          updatedInfo.opfsTotalSize > 0 &&
          fileSystemSize > updatedInfo.opfsTotalSize * 100
      } catch (infoError) {
        console.warn("Failed to get storage info after clearing:", infoError)
        // 忽略错误，继续执行
      }

      // 显示成功消息
      if (hasLargeFileSystem) {
        toast.success(
          t(
            "settings.clearSuccessWithCacheNote",
            "Application data cleared. Note: Browser HTTP cache ({{size}}) cannot be cleared programmatically. Please clear browser cache manually to free up space.",
            {
              size: formatBytes(fileSystemSize),
            },
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

      // 关闭确认对话框
      setShowConfirmDialog(false)

      // 立即重置状态，然后延迟刷新页面
      // 这样即使页面刷新失败，状态也会被重置
      setIsClearing(false)

      // 延迟刷新页面，让用户看到成功消息
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error) {
      // 清除超时保护
      clearTimeout(timeoutId)

      console.error("Failed to clear data:", error)
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      // 检查是否是超时错误
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

      // 确保关闭确认对话框并重置状态
      setShowConfirmDialog(false)
      setIsClearing(false)
    } finally {
      // 双重保险：确保状态被重置
      // 即使前面的代码出错，这里也会执行
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

      {/* 语言设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t("settings.languageSettings", "Language Settings")}
          </CardTitle>
          <CardDescription>
            {t(
              "settings.languageSettingsDesc",
              "Choose your preferred language for the interface",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-foreground text-sm font-semibold">
                {t("settings.language", "Language")}
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {t(
                  "settings.languageDesc",
                  "Select the language for the user interface",
                )}
              </p>
            </div>
            <LanguageSwitcher />
          </div>
        </CardContent>
      </Card>

      {/* 存储设置 */}

      {/* 存储设置 */}
      <Card className="border-destructive/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HardDrive className="text-muted-foreground h-5 w-5" />
              <div>
                <CardTitle className="flex items-center gap-2">
                  {t("settings.storageSettings", "Storage Settings")}
                </CardTitle>
                <CardDescription className="mt-1">
                  {t(
                    "settings.storageSettingsDesc",
                    "Manage storage usage and clear application data",
                  )}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadStorageInfo}
              disabled={isLoadingStorage}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isLoadingStorage ? "animate-spin" : ""}`}
              />
              {t("settings.refresh", "Refresh")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 存储信息部分 */}
          <div className="space-y-4">
            <div>
              <h3 className="text-foreground mb-3 text-sm font-semibold">
                {t("settings.storageInfo", "Storage Information")}
              </h3>
            </div>
            {storageInfo ? (
              <div className="space-y-4">
                {/* 存储配额和使用情况 */}
                {storageInfo.quota !== null && storageInfo.usage !== null && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t("settings.storageUsage", "Storage Usage")}
                      </span>
                      <span className="font-semibold">
                        {formatBytes(storageInfo.usage)} /{" "}
                        {formatBytes(storageInfo.quota)} (
                        {calculatePercentage(
                          storageInfo.usage,
                          storageInfo.quota,
                        )}
                        %)
                      </span>
                    </div>
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full transition-all"
                        style={{
                          width: `${calculatePercentage(
                            storageInfo.usage,
                            storageInfo.quota,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 存储使用详情 */}
                {storageInfo.usageDetails && (
                  <div className="space-y-1 text-sm">
                    <div className="text-foreground font-semibold">
                      {t("settings.storageDetails", "Storage Details")}
                    </div>
                    {Object.entries(storageInfo.usageDetails).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="text-muted-foreground flex items-center justify-between"
                        >
                          <span className="capitalize">
                            {key.replace(/-/g, " ")}
                          </span>
                          <span>{formatBytes(value)}</span>
                        </div>
                      ),
                    )}
                  </div>
                )}

                {/* Service Worker 信息 */}
                {storageInfo.serviceWorkerInfo.registrations > 0 && (
                  <div className="space-y-1 text-sm">
                    <div className="text-foreground font-semibold">
                      {t("settings.serviceWorkers", "Service Workers")}
                    </div>
                    <div className="bg-card text-muted-foreground rounded-md px-2 py-1">
                      <div className="flex items-center justify-between">
                        <span>
                          {t("settings.swRegistrations", "Registrations")}:
                        </span>
                        <span className="font-semibold">
                          {storageInfo.serviceWorkerInfo.registrations}
                        </span>
                      </div>
                      {storageInfo.serviceWorkerInfo.scopes.length > 0 && (
                        <div className="mt-1 text-xs">
                          {storageInfo.serviceWorkerInfo.scopes.map(
                            (scope, idx) => (
                              <div key={idx} className="font-mono">
                                {scope}
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Cache Storage 信息 */}
                {storageInfo.cacheStorageInfo.cacheNames.length > 0 && (
                  <div className="space-y-1 text-sm">
                    <div className="text-foreground font-semibold">
                      {t("settings.cacheStorage", "Cache Storage")}
                    </div>
                    <div className="bg-card text-muted-foreground rounded-md px-2 py-1">
                      <div className="flex items-center justify-between">
                        <span>{t("settings.cacheNames", "Caches")}:</span>
                        <span className="font-semibold">
                          {storageInfo.cacheStorageInfo.cacheNames.length}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span>
                          {t("settings.cacheEntries", "Total Entries")}:
                        </span>
                        <span>{storageInfo.cacheStorageInfo.totalEntries}</span>
                      </div>
                      {storageInfo.cacheStorageInfo.estimatedSize > 0 && (
                        <div className="mt-1 flex items-center justify-between">
                          <span>
                            {t("settings.estimatedSize", "Estimated Size")}:
                          </span>
                          <span className="font-semibold">
                            {formatBytes(
                              storageInfo.cacheStorageInfo.estimatedSize,
                            )}
                          </span>
                        </div>
                      )}
                      {storageInfo.cacheStorageInfo.cacheNames.length > 0 && (
                        <div className="mt-1 text-xs">
                          {storageInfo.cacheStorageInfo.cacheNames.map(
                            (name, idx) => (
                              <div key={idx} className="font-mono">
                                {name}
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* OPFS 文件列表 */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-foreground font-semibold">
                      {t("settings.opfsFiles", "OPFS Files")}
                    </div>
                    {storageInfo.opfsTotalSize > 0 && (
                      <span className="text-muted-foreground text-xs">
                        {t("settings.totalSize", "Total")}:{" "}
                        {formatBytes(storageInfo.opfsTotalSize)}
                      </span>
                    )}
                  </div>
                  {storageInfo.opfsFiles.length === 0 ? (
                    <p className="text-muted-foreground">
                      {t("settings.noOpfsFiles", "No OPFS files found")}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {storageInfo.opfsFilesWithSize.length > 0 ? (
                        // 显示带大小的文件列表
                        storageInfo.opfsFilesWithSize.map((file) => (
                          <div
                            key={file.path}
                            className="bg-card text-muted-foreground flex items-center justify-between rounded-md px-2 py-1"
                          >
                            <span className="font-mono text-xs">
                              {file.name}
                            </span>
                            <span className="text-xs">
                              {formatBytes(file.size)}
                            </span>
                          </div>
                        ))
                      ) : (
                        // 回退到只显示文件名
                        <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                          {storageInfo.opfsFiles.map((file) => (
                            <li key={file}>{file}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* 提示信息 */}
                <div className="bg-card border-border text-muted-foreground rounded-md border p-3 text-sm">
                  <div className="space-y-2">
                    <div>
                      <span className="font-semibold">
                        {t("settings.storageNoteTitle", "About Storage Usage:")}
                      </span>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        <li>
                          {t(
                            "settings.storageNote1",
                            "The 'Storage Usage' shows the total storage used by this origin (including IndexedDB, Cache Storage, etc.), not just OPFS files.",
                          )}
                        </li>
                        <li>
                          {t(
                            "settings.storageNote2",
                            "The actual OPFS file sizes are shown above. An empty database file should be only a few KB.",
                          )}
                        </li>
                        <li>
                          {t(
                            "settings.storageNote3",
                            "Browser storage quota updates may be delayed. If usage doesn't decrease immediately after clearing, wait a few minutes.",
                          )}
                        </li>
                      </ul>
                    </div>
                    {storageInfo.opfsTotalSize > 0 &&
                      storageInfo.usageDetails?.fileSystem &&
                      storageInfo.opfsTotalSize <
                        storageInfo.usageDetails.fileSystem / 100 && (
                        <div className="bg-card border-muted text-muted-foreground rounded border p-3 text-xs">
                          <div className="mb-1 font-semibold">
                            {t(
                              "settings.storageWarningTitle",
                              "⚠️ Large fileSystem Storage Detected",
                            )}
                          </div>
                          <div className="space-y-2">
                            <div>
                              {t(
                                "settings.storageWarning1",
                                "The fileSystem storage ({{fileSystem}}) is much larger than actual OPFS files ({{opfs}}).",
                                {
                                  fileSystem: formatBytes(
                                    storageInfo.usageDetails.fileSystem,
                                  ),
                                  opfs: formatBytes(storageInfo.opfsTotalSize),
                                },
                              )}
                            </div>
                            <div>
                              {t(
                                "settings.storageWarning2",
                                "This likely includes browser-cached files from previous file downloads (e.g., when syncing files from Arweave to calculate hashes).",
                              )}
                            </div>
                            <div className="font-semibold">
                              {t(
                                "settings.storageWarning3",
                                "To free up this space:",
                              )}
                            </div>
                            <ul className="list-disc space-y-1 pl-5">
                              <li>
                                <strong>
                                  {t(
                                    "settings.storageWarning4",
                                    "Clear browser cache:",
                                  )}
                                </strong>{" "}
                                {t(
                                  "settings.storageWarning4Detail",
                                  "Press Ctrl+Shift+Delete (Windows/Linux) or Cmd+Shift+Delete (Mac), then select 'Cached images and files' and click 'Clear data'",
                                )}
                              </li>
                              <li>
                                {t(
                                  "settings.storageWarning5",
                                  "Or wait for browser to automatically clean up old cache (may take hours or days)",
                                )}
                              </li>
                            </ul>
                            <div className="border-border text-foreground mt-2 border-t pt-2 font-semibold">
                              {t(
                                "settings.storageWarning6",
                                "Note: This cache is managed by the browser and cannot be cleared by the application. It does not affect application functionality.",
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground text-center text-sm">
                {isLoadingStorage
                  ? t(
                      "settings.loadingStorage",
                      "Loading storage information...",
                    )
                  : t(
                      "settings.noStorageInfo",
                      "Storage information not available",
                    )}
              </div>
            )}
          </div>

          {/* 分隔线 */}
          <div className="border-destructive/30 border-t pt-6">
            {/* 清除数据部分 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-destructive h-5 w-5" />
                <div>
                  <h3 className="text-destructive text-sm font-semibold">
                    {t("settings.dangerZone", "Danger Zone")}
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {t(
                      "settings.dangerZoneDesc",
                      "Irreversible actions. Please proceed with caution.",
                    )}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-foreground text-sm font-semibold">
                  {t("settings.clearDataTitle", "Clear All Data")}
                </h4>
                <p className="text-muted-foreground text-sm">
                  {t(
                    "settings.clearDataDesc",
                    "This will permanently delete all data including files, folders, accounts, and settings. This action cannot be undone.",
                  )}
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setShowConfirmDialog(true)}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("settings.clearDataButton", "Clear All Data")}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t("settings.confirmTitle", "Confirm Clear All Data")}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {t(
                "settings.confirmDesc",
                "Are you absolutely sure? This will permanently delete:",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
              <li>{t("settings.confirmItem1", "All files and folders")}</li>
              <li>{t("settings.confirmItem2", "All account information")}</li>
              <li>
                {t("settings.confirmItem3", "All settings and preferences")}
              </li>
              <li>
                {t("settings.confirmItem4", "All local database records")}
              </li>
            </ul>
            <p className="text-destructive pt-2 text-sm font-semibold">
              {t("settings.confirmWarning", "This action cannot be undone!")}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isClearing}
            >
              {t("settings.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAllData}
              disabled={isClearing}
            >
              {isClearing
                ? t("settings.clearing", "Clearing...")
                : t("settings.confirmButton", "Yes, Clear All Data")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
