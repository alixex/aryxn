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
import OpfsFilesList from "./storage/OpfsFilesList"
import DangerZone from "./DangerZone"

import { db } from "@/lib/database"

type StorageInfo = Awaited<ReturnType<typeof db.getStorageInfo>>

export default function StorageSettingsCard({
  storageInfo,
  isLoading,
  onRefresh,
  onConfirmClear,
  isClearing,
  openDangerDialog,
  setOpenDangerDialog,
}: {
  storageInfo: StorageInfo | null
  isLoading: boolean
  onRefresh: () => void
  onConfirmClear: () => void
  isClearing: boolean
  openDangerDialog: boolean
  setOpenDangerDialog: (v: boolean) => void
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
    <Card className="border-border/90 bg-card/84 border shadow-[0_16px_30px_-20px_hsl(220_35%_2%/0.72)] transition-all duration-200">
      <CardHeader className="animate-fade-in-down border-border/85 bg-card/92 rounded-t-2xl border-b p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-muted text-foreground rounded-lg p-2">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-foreground text-lg font-semibold">
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
            className="border-border hover:bg-accent"
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

              <OpfsFilesList
                filesWithSize={storageInfo.opfsFilesWithSize}
                files={storageInfo.opfsFiles}
                formatBytes={formatBytes}
              />
            </div>
          ) : (
            <div className="text-muted-foreground py-4 text-center text-sm">
              {isLoading
                ? t("settings.loadingStorage", "Loading storage information...")
                : t(
                    "settings.noStorageInfo",
                    "Storage information not available",
                  )}
            </div>
          )}

          <DangerZone
            onConfirmClear={onConfirmClear}
            isClearing={isClearing}
            open={openDangerDialog}
            setOpen={setOpenDangerDialog}
          />
        </div>
      </CardContent>
    </Card>
  )
}
