import { ShieldCheck, Info } from "lucide-react"
import { ConfigImportExport } from "@/components/account/ConfigImportExport"

interface Props {
  t: any
  walletManager: any
}

export default function AccountSidebar({ t, walletManager }: Props) {
  return (
    <div className="space-y-4 lg:sticky lg:top-8">
      <div className="border-border/70 bg-card/90 overflow-hidden rounded-[28px] border p-5 shadow-[0_14px_36px_-28px_hsl(220_35%_2%/0.5)] transition-all duration-200 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="bg-primary/10 text-primary ring-border/70 rounded-2xl p-2.5 ring-1">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="text-foreground text-lg font-semibold tracking-tight">
            {t("identities.activeVault")}
          </h3>
        </div>
        <div className="border-primary/15 rounded-2xl border bg-[hsl(var(--primary)/0.06)] p-4">
          <div className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-[0.24em] uppercase">
            Vault ID
          </div>
          <div className="text-foreground/85 font-mono text-xs leading-6 break-all">
            {walletManager.vaultId}
          </div>
        </div>
        <p className="mt-4 text-sm leading-7 font-medium text-[hsl(var(--foreground)/0.68)]">
          {t("identities.vaultDesc")}
        </p>
      </div>

      <div className="border-border/70 bg-card/90 overflow-hidden rounded-[28px] border p-5 shadow-[0_14px_36px_-28px_hsl(220_35%_2%/0.5)] transition-all duration-200 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="bg-muted text-foreground ring-border/70 rounded-2xl p-2.5 ring-1">
            <Info className="h-4 w-4" />
          </div>
          <h3 className="text-foreground font-semibold tracking-tight">
            {t("identities.securityInfo")}
          </h3>
        </div>
        <ul className="space-y-3 text-sm leading-6 font-medium text-[hsl(var(--foreground)/0.68)]">
          <li className="border-border/50 flex gap-3 rounded-2xl border bg-[hsl(var(--background)/0.4)] px-3 py-3">
            <span className="text-primary font-bold">•</span>
            <span>{t("identities.securityItem1")}</span>
          </li>
          <li className="border-border/50 flex gap-3 rounded-2xl border bg-[hsl(var(--background)/0.4)] px-3 py-3">
            <span className="text-primary font-bold">•</span>
            <span>{t("identities.securityItem2")}</span>
          </li>
          <li className="border-border/50 flex gap-3 rounded-2xl border bg-[hsl(var(--background)/0.4)] px-3 py-3">
            <span className="text-primary font-bold">•</span>
            <span>{t("identities.securityItem3")}</span>
          </li>
        </ul>
      </div>

      <ConfigImportExport />
    </div>
  )
}
