import { Eye, EyeOff } from "lucide-react"
import { type BalanceResult } from "@/lib/balance"
import { useTranslation } from "@/i18n/config"

interface BalanceDisplayProps {
  chain: string
  balance: BalanceResult | null
  loading: boolean
  showBalance: boolean
  onToggle: (show: boolean) => void
  onRefresh: () => Promise<void>
}

export function BalanceDisplay({
  chain,
  balance,
  loading,
  showBalance,
  onToggle,
  onRefresh,
}: BalanceDisplayProps) {
  const { t } = useTranslation()

  const handleToggle = async () => {
    if (!showBalance) {
      // 显示并刷新余额
      onToggle(true)
      await onRefresh()
    } else {
      // 隐藏余额
      onToggle(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggle}
        className="text-muted-foreground hover:text-foreground shrink-0 p-1 transition-colors"
        title={
          showBalance
            ? t("identities.hideBalance")
            : t("identities.showBalance")
        }
      >
        {showBalance ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </button>
      {loading ? (
        <span className="text-muted-foreground text-xs italic">
          {t("common.loading")}
        </span>
      ) : (
        <div className="flex items-baseline gap-1.5">
          <span className="text-foreground text-sm font-bold">
            {showBalance && balance ? balance.formatted : "****"}
          </span>
          <span className="text-muted-foreground text-xs font-medium uppercase">
            {balance?.symbol || chain.toUpperCase()}
          </span>
        </div>
      )}
    </div>
  )
}
