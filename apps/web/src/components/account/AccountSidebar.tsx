import React from "react"
import { ShieldCheck, Info } from "lucide-react"
import { ConfigImportExport } from "@/components/account/ConfigImportExport"

interface Props {
  t: any
  walletManager: any
}

export default function AccountSidebar({ t, walletManager }: Props) {
  return (
    <div className="space-y-6 px-4 sm:px-0">
      <div className="border-border bg-card rounded-2xl border p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="bg-secondary text-foreground rounded-lg p-2">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="text-foreground font-bold">
            {t("identities.activeVault")}
          </h3>
        </div>
        <div className="text-muted-foreground font-mono text-xs break-all">
          ID: {walletManager.vaultId}
        </div>
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          {t("identities.vaultDesc")}
        </p>
      </div>

      <div className="border-border bg-card rounded-2xl border p-6 sm:p-8">
        <h3 className="text-foreground mb-3 flex items-center gap-2 font-bold">
          <Info className="text-muted-foreground h-4 w-4" />{" "}
          {t("identities.securityInfo")}
        </h3>
        <ul className="text-muted-foreground space-y-3 text-xs leading-relaxed">
          <li>• {t("identities.securityItem1")}</li>
          <li>• {t("identities.securityItem2")}</li>
          <li>• {t("identities.securityItem3")}</li>
        </ul>
      </div>

      <div className="px-4 sm:px-0">
        <ConfigImportExport />
      </div>
    </div>
  )
}
