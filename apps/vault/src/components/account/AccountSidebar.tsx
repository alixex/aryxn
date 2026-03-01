import { ShieldCheck, Info } from "lucide-react"
import { ConfigImportExport } from "@/components/account/ConfigImportExport"

interface Props {
  t: any
  walletManager: any
}

export default function AccountSidebar({ t, walletManager }: Props) {
  return (
    <div className="space-y-6 px-4 sm:px-0">
      <div className="glass-premium hover:shadow-primary/5 border-none p-6 shadow-2xl transition-all duration-500 sm:p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="bg-secondary text-foreground rounded-2xl p-2.5 shadow-lg ring-1 ring-white/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="text-foreground text-lg font-extrabold tracking-tight">
            {t("identities.activeVault")}
          </h3>
        </div>
        <div className="text-muted-foreground bg-primary/5 border-primary/10 rounded-xl border p-3 font-mono text-xs break-all">
          ID: {walletManager.vaultId}
        </div>
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed font-medium">
          {t("identities.vaultDesc")}
        </p>
      </div>

      <div className="glass-premium hover:shadow-primary/5 border-none p-6 shadow-2xl transition-all duration-500 sm:p-8">
        <h3 className="text-foreground mb-4 flex items-center gap-2 font-extrabold tracking-tight">
          <Info className="text-primary h-4 w-4" />{" "}
          {t("identities.securityInfo")}
        </h3>
        <ul className="text-muted-foreground space-y-3 text-xs leading-relaxed font-medium">
          <li className="flex gap-2">
            <span className="text-primary font-bold">•</span>
            <span>{t("identities.securityItem1")}</span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary font-bold">•</span>
            <span>{t("identities.securityItem2")}</span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary font-bold">•</span>
            <span>{t("identities.securityItem3")}</span>
          </li>
        </ul>
      </div>

      <div className="px-4 sm:px-0">
        <ConfigImportExport />
      </div>
    </div>
  )
}
