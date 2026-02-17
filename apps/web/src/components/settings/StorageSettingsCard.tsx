import { RefreshCw, HardDrive } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useTranslation } from "@/i18n/config"
import StorageQuota from "./storage/StorageQuota"
import ServiceWorkerInfo from "./storage/ServiceWorkerInfo"
import CacheStorageInfo from "./storage/CacheStorageInfo"
import OpfsFilesList from "./storage/OpfsFilesList"

import { db } from "@/lib/database"

type StorageInfo = Awaited<ReturnType<typeof db.getStorageInfo>>

export default function StorageSettingsCard({
  storageInfo,
  isLoading,
  onRefresh,
}: {
  storageInfo: StorageInfo | null
  isLoading: boolean
  onRefresh: () => void
}) {
  const { t } = useTranslation()

  const formatBytes = (bytes: number | null) => {
    if (bytes === null || bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  return (
    <Card className="glass-premium hover:shadow-primary/5 border-none shadow-2xl transition-all duration-500">
      <CardHeader className="glass-strong animate-fade-in-down border-accent/30 bg-card/60 rounded-t-2xl border-b-2 p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cyan-400/20 p-2">
              <HardDrive className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-foreground text-lg font-bold">
                {t("settings.storageSettings", "Storage Settings")}
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs font-medium">
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
            onClick={onRefresh}
            disabled={isLoading}
            className="border-accent/20 hover:bg-accent/10"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            {t("settings.refresh", "Refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-foreground mb-3 text-sm font-semibold">
              {t("settings.storageInfo", "Storage Information")}
            </h3>
          </div>

          {storageInfo ? (
            <div className="space-y-4">
              <StorageQuota
                usage={storageInfo.usage}
                quota={storageInfo.quota}
                formatBytes={formatBytes}
              />

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
                        <span>{formatBytes(value as number)}</span>
                      </div>
                    ),
                  )}
                </div>
              )}

              <ServiceWorkerInfo info={storageInfo.serviceWorkerInfo} />
              <CacheStorageInfo
                info={storageInfo.cacheStorageInfo}
                formatBytes={formatBytes}
              />
              <OpfsFilesList
                filesWithSize={storageInfo.opfsFilesWithSize}
                files={storageInfo.opfsFiles}
              />

              {/* Storage notes and warnings */}
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
              {isLoading
                ? t("settings.loadingStorage", "Loading storage information...")
                : t(
                    "settings.noStorageInfo",
                    "Storage information not available",
                  )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
