import { useTranslation } from "@/i18n/config"

export default function ServiceWorkerInfo({
  info,
}: {
  info: { registrations: number; scopes: string[] }
}) {
  const { t } = useTranslation()
  if (!info || info.registrations === 0) return null

  return (
    <div className="space-y-1 text-sm">
      <div className="text-foreground font-semibold">
        {t("settings.serviceWorkers", "Service Workers")}
      </div>
      <div className="bg-card text-muted-foreground rounded-md px-2 py-1">
        <div className="flex items-center justify-between">
          <span>{t("settings.swRegistrations", "Registrations")}: </span>
          <span className="font-semibold">{info.registrations}</span>
        </div>
        {info.scopes.length > 0 && (
          <div className="mt-1 text-xs">
            {info.scopes.map((s, idx) => (
              <div key={idx} className="font-mono">
                {s}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
