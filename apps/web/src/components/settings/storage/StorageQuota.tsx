import { useTranslation } from "@/i18n/config"

export default function StorageQuota({
  usage,
  quota,
  formatBytes,
}: {
  usage: number | null
  quota: number | null
  formatBytes: (n: number | null) => string
}) {
  const { t } = useTranslation()

  const calculatePercentage = (usage: number | null, quota: number | null) => {
    if (!usage || !quota) return 0
    return Math.round((usage / quota) * 100)
  }

  if (usage === null || quota === null) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {t("settings.storageUsage", "Storage Usage")}
        </span>
        <span className="font-semibold">
          {formatBytes(usage)} / {formatBytes(quota)} (
          {calculatePercentage(usage, quota)}%)
        </span>
      </div>
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full transition-all"
          style={{ width: `${calculatePercentage(usage, quota)}%` }}
        />
      </div>
    </div>
  )
}
