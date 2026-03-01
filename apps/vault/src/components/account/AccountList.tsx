import { Wallet } from "lucide-react"
import { useTranslation } from "@/i18n/config"
import { AccountCard } from "./AccountCard"
import type { BalanceResult } from "@/lib/chain"

interface Account {
  id?: string | number
  chain: string
  address: string
  alias: string
  isExternal: boolean
  encryptedKey?: string
  vaultId?: string
  createdAt?: number
}

interface AccountListProps {
  chain: string
  accounts: Account[]
  isActive: (account: Account) => boolean
  onSelect: (account: Account) => void
  onCopyAddress: (address: string) => void
  onShowSensitive?: (account: Account, type: "key" | "mnemonic") => void
  onDisconnect?: (account: Account) => void
  onDelete?: (account: Account) => void
  // New props for lifting state
  balances: Record<string, BalanceResult | null>
  loadingBalances: Record<string, boolean>
  showBalances: Record<string, boolean>
  onRefreshBalance: (
    chain: string,
    address: string,
    isExternal: boolean,
  ) => void
  onToggleBalance: (key: string, show: boolean) => void
}

export function AccountList({
  chain,
  accounts,
  isActive,
  onSelect,
  onCopyAddress,
  onShowSensitive,
  onDisconnect,
  onDelete,
  balances,
  loadingBalances,
  showBalances,
  onRefreshBalance,
  onToggleBalance,
}: AccountListProps) {
  const { t } = useTranslation()

  if (accounts.length === 0) {
    return (
      <div className="space-y-3">
        <div className="glass-strong animate-fade-in-down border-accent/20 bg-card/40 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-12 text-center shadow-lg transition-all duration-500">
          <div className="bg-accent/10 mb-4 rounded-full p-4">
            <Wallet className="text-foreground/40 h-10 w-10" />
          </div>
          <p className="text-muted-foreground max-w-50 text-sm font-medium italic">
            {t("identities.emptyState", { chain })}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => {
        const active = isActive(account)
        const key = account.isExternal
          ? `external-${account.chain}-${account.address}`
          : `${account.chain}-${account.address}`

        return (
          <AccountCard
            key={account.id || `${account.chain}-${account.address}`}
            account={account}
            isActive={active}
            onSelect={() => onSelect(account)}
            onCopyAddress={onCopyAddress}
            onShowSensitive={onShowSensitive}
            onDisconnect={
              onDisconnect ? () => onDisconnect(account) : undefined
            }
            onDelete={onDelete ? () => onDelete(account) : undefined}
            balance={balances[key]}
            loading={loadingBalances[key]}
            showBalance={showBalances[key]}
            onToggleBalance={(show) => onToggleBalance(key, show)}
            onRefreshBalance={() =>
              onRefreshBalance(
                account.chain,
                account.address,
                account.isExternal,
              )
            }
          />
        )
      })}
    </div>
  )
}
