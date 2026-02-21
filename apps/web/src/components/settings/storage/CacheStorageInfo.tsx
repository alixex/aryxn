import { useTranslation } from "@/i18n/config"

export default function CacheStorageInfo({
  info,
  formatBytes,
}: {
  info: { cacheNames: string[]; totalEntries: number; estimatedSize: number }
  formatBytes: (n: number | null) => string
}) {
  const { t } = useTranslation()
  if (!info || info.cacheNames.length === 0) return null

  return (
    <div className="space-y-1 text-sm">
      <div className="text-foreground font-semibold">
        {t("settings.cacheStorage", "Cache Storage")}
      </div>
      <div className="bg-card text-muted-foreground rounded-md px-2 py-1">
        <div className="flex items-center justify-between">
          <span>{t("settings.cacheNames", "Caches")}:</span>
          <span className="font-semibold">{info.cacheNames.length}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span>{t("settings.cacheEntries", "Total Entries")}:</span>
          <span>{info.totalEntries}</span>
        </div>
        {info.estimatedSize > 0 && (
          <div className="mt-1 flex items-center justify-between">
            <span>{t("settings.estimatedSize", "Estimated Size")}:</span>
            <span className="font-semibold">
              {formatBytes(info.estimatedSize)}
            </span>
          </div>
        )}
        <div className="mt-1 text-xs">
          {info.cacheNames.map((name, idx) => (
            <div key={idx} className="font-mono">
              {name}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
