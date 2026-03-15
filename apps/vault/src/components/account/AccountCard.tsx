import { Copy, Key, FileText, Trash2 } from "lucide-react"
import { TokenBalanceChains } from "@aryxn/chain-constants"
import { Button } from "@/components/ui/button"
import { BalanceDisplay } from "./BalanceDisplay"
import { TokenBalances } from "./TokenBalances"
import { useTranslation } from "@/i18n/config"
import {
  ArweaveIcon,
  EthereumIcon,
  SolanaIcon,
  SuiIcon,
  BitcoinIcon,
  PolygonIcon,
  BscIcon,
  AvalancheIcon,
} from "@/components/icons"

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

import type { BalanceResult } from "@/lib/chain"

interface AccountCardProps {
  account: Account
  isActive: boolean
  onSelect: () => void
  onCopyAddress: (address: string) => void
  onShowSensitive?: (account: Account, type: "key" | "mnemonic") => void
  onDelete?: () => void
  // New props for lifting state
  balance?: BalanceResult | null
  loading?: boolean
  showBalance?: boolean
  onToggleBalance?: (show: boolean) => void
  onRefreshBalance?: () => void
}

const TOKEN_BALANCE_CHAIN_SET = new Set<string>(TokenBalanceChains)

const getChainIcon = (chain?: string) => {
  switch (chain?.toLowerCase()) {
    case "ethereum":
      return <EthereumIcon className="h-6 w-6" />
    case "solana":
      return <SolanaIcon className="h-6 w-6" />
    case "bitcoin":
      return <BitcoinIcon className="h-6 w-6" />
    case "sui":
      return <SuiIcon className="h-6 w-6" />
    case "arweave":
      return <ArweaveIcon className="h-6 w-6" />
    case "polygon":
    case "matic":
      return <PolygonIcon className="h-6 w-6" />
    case "bsc":
    case "binance":
      return <BscIcon className="h-6 w-6" />
    case "avalanche":
    case "avax":
      return <AvalancheIcon className="h-6 w-6" />
    default:
      return null
  }
}

export function AccountCard({
  account,
  isActive,
  onSelect,
  onCopyAddress,
  onShowSensitive,
  onDelete,
  balance,
  loading,
  showBalance = false,
  onToggleBalance,
  onRefreshBalance,
}: AccountCardProps) {
  const { t } = useTranslation()

  return (
    <div
      className={`glass-strong animate-fade-in-down group relative cursor-pointer overflow-hidden rounded-[26px] border p-5 shadow-[0_14px_30px_-24px_hsl(220_35%_2%/0.48)] transition-all duration-200 sm:p-6 ${
        isActive
          ? "border-primary/35 bg-card/92 shadow-[0_18px_34px_-28px_hsl(var(--primary)/0.28)]"
          : "border-border/70 bg-card/78 hover:border-primary/40 hover:-translate-y-0.5"
      }`}
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest("button") || target.closest('[role="button"]')) {
          return
        }
        onSelect()
      }}
    >
      {isActive && (
        <div className="absolute top-0 left-0 h-full w-1 bg-[linear-gradient(180deg,hsl(var(--primary))_0%,hsl(var(--primary)/0.2)_100%)]" />
      )}
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,hsl(var(--foreground)/0.12),transparent)]" />
      <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all sm:h-12 sm:w-12 ${
                isActive
                  ? "border-primary/20 bg-primary/12 text-primary shadow-sm"
                  : "border-border/60 text-muted-foreground group-hover:border-primary/20 bg-[hsl(var(--background)/0.6)]"
              }`}
            >
              <div className="scale-75 sm:scale-100">
                {getChainIcon(account.chain)}
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="border-border/60 text-muted-foreground rounded-full border bg-[hsl(var(--background)/0.58)] px-2.5 py-1 text-[10px] font-semibold tracking-[0.24em] uppercase">
                  {account.chain}
                </span>
                <h3 className="text-foreground truncate text-sm font-semibold sm:text-base">
                  {account.alias || account.address}
                </h3>
                <div className="flex gap-1.5">
                  {isActive && (
                    <span className="border-primary/20 bg-primary/12 text-primary shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase">
                      {t("identities.currentAccount")}
                    </span>
                  )}
                </div>
              </div>
              <div className="border-border/60 text-muted-foreground flex items-center gap-2 rounded-2xl border bg-[hsl(var(--background)/0.5)] px-3 py-2.5 font-mono text-[10px] sm:text-xs">
                <span className="truncate">{account.address}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCopyAddress(account.address)
                  }}
                  className="text-muted-foreground hover:text-primary shrink-0 rounded-full p-1.5 transition-colors hover:bg-[hsl(var(--background)/0.9)]"
                  title={t("common.copy")}
                >
                  <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
              </div>
              <div className="border-border/60 space-y-3 rounded-[22px] border bg-[hsl(var(--background)/0.52)] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground/70 text-[10px] font-bold tracking-[0.28em] uppercase">
                    {t("identities.tokenAssets")}
                  </span>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
                  <BalanceDisplay
                    chain={account.chain}
                    balance={balance || null}
                    loading={loading || false}
                    showBalance={showBalance}
                    onToggle={onToggleBalance || (() => {})}
                    onRefresh={
                      onRefreshBalance
                        ? async () => onRefreshBalance()
                        : async () => {}
                    }
                  />

                  {/* Show token balances for Ethereum, Solana and Sui accounts */}
                  {TOKEN_BALANCE_CHAIN_SET.has(account.chain) && (
                    <div className="flex-1">
                      <TokenBalances
                        address={account.address}
                        chain={account.chain}
                        isUnlocked={true}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div
            className="border-border/60 flex items-center gap-1 self-end rounded-full border bg-[hsl(var(--background)/0.45)] p-1 sm:self-start"
            onClick={(e) => e.stopPropagation()}
          >
            {onShowSensitive && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onShowSensitive(account, "key")}
                  className="text-muted-foreground hover:bg-accent hover:text-primary h-8 w-8 rounded-full p-0"
                  title={t("identities.viewSensitive")}
                >
                  <Key className="h-4 w-4" />
                </Button>
                {account.chain !== "arweave" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onShowSensitive(account, "mnemonic")}
                    className="text-muted-foreground hover:bg-accent hover:text-primary h-8 w-8 rounded-full p-0"
                    title={t("identities.mnemonic")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            {onDelete && !account.isExternal && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 w-8 rounded-full p-0"
                title={t("identities.deleteAccountConfirm")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
