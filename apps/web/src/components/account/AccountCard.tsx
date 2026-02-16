import {
  Copy,
  Key,
  FileText,
  Unlink,
  ExternalLink,
  UserCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { BalanceDisplay } from "./BalanceDisplay"
import { TokenBalances } from "./TokenBalances"
import { type BalanceResult } from "@/lib/balance"
import { useTranslation } from "@/i18n/config"
import { toast } from "sonner"
import {
  ArweaveIcon,
  EthereumIcon,
  SolanaIcon,
  SuiIcon,
  BitcoinIcon,
} from "@/components/icons"
import type { WalletConnector } from "@/types/global"

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

interface AccountCardProps {
  account: Account
  isActive: boolean
  balance: BalanceResult | null
  loading: boolean
  showBalance: boolean
  onToggleBalance: (show: boolean) => void
  onRefreshBalance: () => Promise<void>
  onSelect: () => void
  onCopyAddress: (address: string) => void
  onShowSensitive?: (account: Account, type: "key" | "mnemonic") => void
  onDisconnect?: () => void
  // External account props
  isPaymentConnected?: boolean
  connector?: WalletConnector
  paymentAddress?: string
}

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
    default:
      return null
  }
}

export function AccountCard({
  account,
  isActive,
  balance,
  loading,
  showBalance,
  onToggleBalance,
  onRefreshBalance,
  onSelect,
  onCopyAddress,
  onShowSensitive,
  onDisconnect,
  isPaymentConnected,
  connector,
}: AccountCardProps) {
  const { t } = useTranslation()

  return (
    <div
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
        isActive
          ? "border-ring bg-card scale-[1.01] shadow-md"
          : "border-border bg-card hover:border-ring hover:-translate-y-1 hover:shadow-md"
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
        <div className="bg-primary absolute top-0 left-0 h-full w-1" />
      )}
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all sm:h-12 sm:w-12 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted-foreground group-hover:bg-muted"
              }`}
            >
              <div className="scale-75 sm:scale-100">
                {getChainIcon(account.chain)}
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-foreground truncate text-sm font-bold sm:text-base">
                  {account.alias}
                </h3>
                <div className="flex gap-1.5">
                  {isActive && (
                    <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">
                      {t("identities.currentAccount")}
                    </span>
                  )}
                  {account.isExternal && !isActive && (
                    <span className="bg-secondary text-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">
                      {t("identities.externalConnected")}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-muted-foreground flex items-center gap-2 font-mono text-[10px] sm:text-xs">
                <span className="truncate">{account.address}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCopyAddress(account.address)
                  }}
                  className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer p-1 transition-colors"
                  title={t("common.copy")}
                >
                  <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
              </div>
              <div className="pt-1">
                <BalanceDisplay
                  chain={account.chain}
                  balance={balance}
                  loading={loading}
                  showBalance={showBalance}
                  onToggle={onToggleBalance}
                  onRefresh={onRefreshBalance}
                />
              </div>
              {/* Show token balances for Ethereum, Solana and Sui accounts */}
              {(account.chain === "ethereum" ||
                account.chain === "solana" ||
                account.chain === "sui") &&
                !account.isExternal && (
                  <TokenBalances
                    address={account.address}
                    chain={account.chain}
                    isUnlocked={true}
                  />
                )}
            </div>
          </div>
          <div
            className="flex items-center gap-1 self-end sm:self-start"
            onClick={(e) => e.stopPropagation()}
          >
            {account.isExternal ? (
              <>
                {account.chain === "ethereum" && isPaymentConnected ? (
                  <ConnectButton.Custom>
                    {({ openAccountModal }) => (
                      <>
                        {!isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async (e) => {
                              e.stopPropagation()
                              try {
                                if (
                                  connector &&
                                  "provider" in connector &&
                                  connector.provider
                                ) {
                                  const provider = connector.provider as {
                                    request?: (args: {
                                      method: string
                                    }) => Promise<unknown>
                                  }
                                  try {
                                    if (provider.request) {
                                      await provider.request({
                                        method: "eth_requestAccounts",
                                      })
                                    }
                                    toast.info(
                                      t("identities.switchAccountInWallet", {
                                        address: `${account.address.slice(0, 6)}...${account.address.slice(-4)}`,
                                      }),
                                      { duration: 4000 },
                                    )
                                    return
                                  } catch (reqError) {
                                    console.debug(
                                      "Account request failed:",
                                      reqError,
                                    )
                                  }
                                }
                                openAccountModal()
                                toast.info(
                                  t("identities.switchAccountInModal"),
                                  {
                                    duration: 3000,
                                  },
                                )
                              } catch (error) {
                                console.error(
                                  "Failed to switch account:",
                                  error,
                                )
                                openAccountModal()
                                toast.error(t("identities.switchAccountFailed"))
                              }
                            }}
                            className="text-foreground hover:bg-accent h-8 px-3 text-xs font-semibold"
                            title={t("identities.switchAccount")}
                          >
                            <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                            {t("identities.switchAccount")}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openAccountModal()
                          }}
                          className="text-muted-foreground hover:bg-accent hover:text-foreground h-8 w-8 p-0"
                          title={t("identities.manageAccount")}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </ConnectButton.Custom>
                ) : null}
                {onDisconnect && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDisconnect}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 w-8 p-0"
                    title={t("identities.disconnect")}
                  >
                    <Unlink className="h-4 w-4" />
                  </Button>
                )}
              </>
            ) : (
              <>
                {onShowSensitive && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onShowSensitive(account, "key")}
                      className="text-muted-foreground hover:bg-accent hover:text-foreground h-8 w-8 p-0"
                      title={t("identities.viewSensitive")}
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                    {account.chain !== "arweave" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onShowSensitive(account, "mnemonic")}
                        className="text-muted-foreground hover:bg-accent hover:text-foreground h-8 w-8 p-0"
                        title={t("identities.mnemonic")}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
