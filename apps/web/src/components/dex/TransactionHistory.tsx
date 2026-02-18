import {
  History,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink,
} from "lucide-react"
import { useTranslation } from "@/i18n/config"
import { cn } from "@/lib/utils"

import { useBridgeHistory } from "@/lib/store/bridge-history"

export function TransactionHistory() {
  const { t } = useTranslation()
  const transactions = useBridgeHistory((state) => state.transactions)

  return (
    <div className="glass-premium overflow-hidden rounded-2xl border-none shadow-2xl">
      <div className="border-border/50 border-b p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <History className="h-5 w-5 text-cyan-400" />
          {t("dex.history", "Recent Activity")}
        </h3>
      </div>

      <div className="max-h-[400px] space-y-2 overflow-y-auto p-2">
        {transactions.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            {t("dex.noHistory", "No recent transactions")}
          </div>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="group hover:bg-secondary/50 cursor-default rounded-xl p-3 transition-all"
            >
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {tx.status === "PENDING" && (
                    <Clock className="h-4 w-4 animate-pulse text-blue-400" />
                  )}
                  {tx.status === "COMPLETED" && (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  )}
                  {tx.status === "FAILED" && (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span
                    className={cn(
                      "bg-secondary text-muted-foreground rounded-full px-2 py-0.5 text-xs font-bold",
                      tx.type === "BRIDGE" &&
                        "bg-purple-500/10 text-purple-400",
                      tx.type === "SWAP" && "bg-blue-500/10 text-blue-400",
                      tx.type === "SEND" && "bg-orange-500/10 text-orange-400",
                    )}
                  >
                    {tx.type}
                  </span>
                </div>
                <span className="text-muted-foreground text-[10px]">
                  {new Date(tx.timestamp).toLocaleDateString()}
                </span>
              </div>

              <div className="pl-6">
                <p className="text-foreground text-sm font-medium">
                  {tx.description}
                </p>
                {tx.hash && (
                  <a
                    href="#"
                    className="text-muted-foreground mt-1 flex items-center gap-1 text-[10px] hover:text-cyan-400"
                  >
                    View on Explorer <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
