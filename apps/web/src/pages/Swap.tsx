import { useEffect, useMemo, useState } from "react"
import {
  TrendingUp,
  Wallet,
  ArrowRightLeft,
  Send,
  AlertCircle,
  ArrowRight,
  History,
} from "lucide-react"
import { useAccount } from "wagmi"
import { Link, useSearchParams } from "react-router-dom"
import { useTranslation } from "@/i18n/config"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/hooks/account-hooks"
import type { WalletRecord } from "@/lib/utils"
import { AccountStatusBadge } from "@/components/account/AccountStatusBadge"
import { PageHeader } from "@/components/layout/PageHeader"
import { AccountChains, Chains } from "@aryxn/chain-constants"
import { useUserAccountSetup } from "@/hooks/account-hooks/use-user-account-setup"
// Components
import { UniversalSwapCard } from "@/components/swap/UniversalSwapCard"
import { TransferCard } from "@/components/swap/TransferCard"
import { TransactionHistory } from "@/components/swap/TransactionHistory"

type DexSelectableAccount = {
  chain: string
  address: string
  alias?: string
  isExternal: boolean
}

function accountKey(account: DexSelectableAccount) {
  return `${account.chain}:${account.address}`
}

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function chainLabel(chain: string) {
  const labels: Record<string, string> = {
    [Chains.ETHEREUM]: "Ethereum",
    [Chains.SOLANA]: "Solana",
    [Chains.SUI]: "Sui",
    [Chains.ARWEAVE]: "Arweave",
    [Chains.BITCOIN]: "Bitcoin",
  }
  return labels[chain] || chain
}

export default function SwapPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const { isConnected, address: externalAddress } = useAccount()
  const wallet = useWallet()
  const activeEvm = wallet.active.evm
  const internalActiveAddress = wallet.internal.activeAddress

  // Check if internal wallet is available for Ethereum
  const hasInternalEthAccount = !!activeEvm && !activeEvm.isExternal

  const displayAddress =
    isConnected && externalAddress
      ? externalAddress
      : activeEvm?.address || internalActiveAddress

  // Get active account alias for display
  const activeAccountAlias = !isConnected
    ? wallet.internal.wallets.find(
        (w: WalletRecord) => w.address === displayAddress,
      )?.alias
    : undefined

  const defaultTab =
    searchParams.get("tab") === "transfer"
      ? "transfer"
      : searchParams.get("tab") === "history"
        ? "history"
        : "swap"
  const [activeTab, setActiveTab] = useState(defaultTab)
  const bridgeFromUpload = searchParams.get("source") === "upload"
  const bridgeToken = searchParams.get("token") || ""
  const bridgeChain = searchParams.get("chain") || ""
  const redirectAction = searchParams.get("action") || ""

  const accountsByChain = wallet.getAccountsByChain()
  const selectableAccounts = useMemo<DexSelectableAccount[]>(() => {
    const discoveredChains = Object.keys(accountsByChain)
    const orderedChains = [
      ...AccountChains,
      ...discoveredChains.filter(
        (chain) => !AccountChains.includes(chain as any),
      ),
    ]

    return orderedChains.flatMap((chain) =>
      (accountsByChain[chain] || []).map((account) => ({
        chain: account.chain,
        address: account.address,
        alias: account.alias,
        isExternal: account.isExternal,
      })),
    )
  }, [accountsByChain])

  const { needsAccountSetup } = useUserAccountSetup()

  const [selectedAccount, setSelectedAccount] =
    useState<DexSelectableAccount | null>(null)

  useEffect(() => {
    if (selectableAccounts.length === 0) {
      if (selectedAccount) setSelectedAccount(null)
      return
    }

    if (!selectedAccount) {
      setSelectedAccount(selectableAccounts[0])
      return
    }

    const exists = selectableAccounts.some(
      (account) => accountKey(account) === accountKey(selectedAccount),
    )

    if (!exists) {
      setSelectedAccount(selectableAccounts[0])
    }
  }, [selectableAccounts, selectedAccount])

  const handleSelectAccount = async (value: string) => {
    const nextAccount = selectableAccounts.find(
      (account) => accountKey(account) === value,
    )
    if (!nextAccount) return

    setSelectedAccount(nextAccount)

    if (!nextAccount.isExternal) {
      await wallet.internal.selectWallet(nextAccount.address)
    }
  }

  return (
    <div className="mesh-gradient relative min-h-screen">
      <div className="mx-auto max-w-6xl space-y-6 px-3 py-6 sm:space-y-8 sm:px-4 sm:py-8">
        <PageHeader
          title={t("dex.title")}
          description={t("dex.description")}
          icon={
            <TrendingUp
              className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8"
              aria-hidden="true"
            />
          }
          iconContainerClassName="bg-gradient-secondary glow-purple"
          rightSlot={
            displayAddress ? (
              <AccountStatusBadge
                label={
                  isConnected
                    ? t("identities.currentAccount")
                    : t("common.activeAccountLabel")
                }
                value={
                  hasInternalEthAccount && !isConnected && activeAccountAlias
                    ? activeAccountAlias
                    : !isConnected && activeAccountAlias
                      ? activeAccountAlias
                      : `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
                }
              />
            ) : (
              <AccountStatusBadge
                label={t("common.activeAccountLabel")}
                value={t("common.noAccount")}
                actionHref="/account"
                actionAriaLabel={t("common.account")}
                actionIcon={
                  <Wallet
                    className="text-muted-foreground h-4 w-4"
                    aria-hidden="true"
                  />
                }
              />
            )
          }
        />

        <div className="space-y-6">
          <div>
            {needsAccountSetup ? (
              <div className="glass-strong animate-fade-in-down border-accent/30 bg-card/60 mb-4 flex items-start gap-4 rounded-2xl border-2 p-6 shadow-lg">
                <div className="bg-accent/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <AlertCircle className="text-accent h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="mb-2 text-base leading-relaxed font-bold">
                    {t("history.needAccountSetup")}
                  </p>
                  <p className="text-subtitle-muted mb-3 text-sm leading-relaxed">
                    {t("history.accountSetupHint")}
                  </p>
                  <Link to="/account">
                    <Button
                      variant="outline"
                      className="border-border bg-background text-foreground hover:bg-accent rounded-lg font-semibold"
                    >
                      {t("upload.goToAccount")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="border-border bg-card/50 text-muted-foreground mb-4 rounded-xl border px-4 py-3 text-sm">
                {t(
                  "dex.accountSelectionHint",
                  "Please choose account and token based on Account settings before swap or bridge.",
                )}
              </div>
            )}

            {!needsAccountSetup &&
              bridgeFromUpload &&
              (activeTab === "bridge" || activeTab === "swap") && (
                <div className="border-border bg-card/50 text-muted-foreground mb-4 rounded-xl border px-4 py-3 text-sm">
                  {redirectAction === "swap"
                    ? t(
                        "dex.swapIntentFromUpload",
                        "Swap required for upload payment",
                      )
                    : t(
                        "dex.bridgeIntentFromUpload",
                        "Bridge required for upload payment",
                      )}
                  {bridgeToken && ` · ${bridgeToken}`}
                  {bridgeChain && ` · ${bridgeChain}`}
                  <div className="mt-1 text-xs opacity-80">
                    {t(
                      "dex.uploadRetryHint",
                      "After completing swap/bridge, return to Upload and submit again.",
                    )}
                  </div>
                </div>
              )}

            {!needsAccountSetup && (
              <>
                <div className="border-border bg-card/50 mb-4 rounded-xl border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-foreground text-sm font-semibold">
                        {t("common.activeAccountLabel")}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {selectedAccount
                          ? `${chainLabel(selectedAccount.chain)} · ${selectedAccount.isExternal ? "External" : "Internal"}`
                          : t("common.noAccount")}
                      </div>
                    </div>
                    {selectedAccount && (
                      <div className="text-right">
                        <div className="text-foreground text-sm font-medium">
                          {selectedAccount.alias ||
                            formatAddress(selectedAccount.address)}
                        </div>
                        <div className="text-muted-foreground font-mono text-xs">
                          {selectedAccount.address}
                        </div>
                      </div>
                    )}
                  </div>

                  <Select
                    value={
                      selectedAccount ? accountKey(selectedAccount) : undefined
                    }
                    onValueChange={handleSelectAccount}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue
                        placeholder={t(
                          "upload.selectPaymentAccount",
                          "Select account",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableAccounts.map((account) => (
                        <SelectItem
                          key={accountKey(account)}
                          value={accountKey(account)}
                        >
                          {chainLabel(account.chain)} ·{" "}
                          {account.alias || formatAddress(account.address)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Tabs
                  defaultValue={defaultTab}
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <div className="mb-6 flex items-center justify-between">
                    <TabsList className="glass-premium h-12 w-full p-1 sm:w-auto">
                      <TabsTrigger
                        value="swap"
                        className="flex-1 gap-2 sm:w-32"
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                        {t("dex.swap", "Swap")}
                      </TabsTrigger>
                      <TabsTrigger
                        value="transfer"
                        className="flex-1 gap-2 sm:w-32"
                      >
                        <Send className="h-4 w-4" />
                        {t("dex.transfer", "Send")}
                      </TabsTrigger>
                      <TabsTrigger
                        value="history"
                        className="flex-1 gap-2 sm:w-32"
                      >
                        <History className="h-4 w-4" />
                        {t("history.title", "History")}
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="swap" className="mt-0">
                    <UniversalSwapCard
                      selectedAccount={selectedAccount}
                      onNavigateToHistory={() => setActiveTab("history")}
                    />
                  </TabsContent>

                  <TabsContent value="transfer" className="mt-0">
                    <TransferCard selectedAccount={selectedAccount} />
                  </TabsContent>

                  <TabsContent value="history" className="mt-0">
                    <TransactionHistory />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
// End of component
