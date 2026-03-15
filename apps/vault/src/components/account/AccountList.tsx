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
      <div className="space-y-4">
        <div className="animate-fade-in-down border-border/60 flex flex-col items-center justify-center rounded-[26px] border border-dashed bg-[hsl(var(--card)/0.7)] px-6 py-14 text-center shadow-[0_12px_28px_-24px_hsl(220_35%_2%/0.45)] transition-all duration-500">
          <div className="border-border/60 mb-4 rounded-full border bg-[hsl(var(--background)/0.65)] p-4">
            <Wallet className="text-foreground/40 h-10 w-10" />
          </div>
          <div className="text-foreground text-base font-semibold tracking-tight">
            {chain}
          </div>
          <p className="mt-2 max-w-sm text-sm leading-6 font-medium text-[hsl(var(--foreground)/0.65)]">
            {t("identities.emptyState", { chain })}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
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
