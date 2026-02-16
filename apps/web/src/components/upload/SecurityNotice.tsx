import { ShieldCheck } from "lucide-react"
import { useTranslation } from "@/i18n/config"

export function SecurityNotice() {
  const { t } = useTranslation()

  return (
    <div className="glass border-border bg-card flex items-start gap-4 rounded-2xl border-2 p-6">
      <div className="bg-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
        <ShieldCheck className="text-foreground h-5 w-5" />
      </div>
      <div className="text-foreground flex-1 text-sm leading-relaxed">
        <p className="mb-2 text-base font-bold sm:text-lg">
          {t("common.securityNotice")}
        </p>
        <p className="text-muted-foreground text-sm">
          {t("common.securityNoticeDesc")}
        </p>
      </div>
    </div>
  )
}
