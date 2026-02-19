import { useState } from "react"
import { TrendingUp, Wallet, ArrowRightLeft, Send } from "lucide-react"
import { useConnection } from "wagmi"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "@/i18n/config"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useWallet } from "@/hooks/account-hooks"
import type { WalletRecord } from "@/lib/utils"
import { AccountStatusBadge } from "@/components/account/AccountStatusBadge"
import { PageHeader } from "@/components/layout/PageHeader"
// Components
import { SwapCard } from "@/components/swap/SwapCard"
import { BridgeCard } from "@/components/swap/BridgeCard"
import { TransferCard } from "@/components/swap/TransferCard"
import { TransactionHistory } from "@/components/swap/TransactionHistory"

export default function SwapPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const { isConnected, address: externalAddress } = useConnection()
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

  const defaultTab = searchParams.get("tab") === "bridge" ? "bridge" : "swap"
  const [activeTab, setActiveTab] = useState(defaultTab)
  const bridgeFromUpload = searchParams.get("source") === "upload"
  const bridgeToken = searchParams.get("token") || ""
  const bridgeChain = searchParams.get("chain") || ""
  const redirectAction = searchParams.get("action") || ""

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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Action Area */}
          <div className="lg:col-span-2">
            <div className="border-border bg-card/50 text-muted-foreground mb-4 rounded-xl border px-4 py-3 text-sm">
              {t(
                "dex.accountSelectionHint",
                "Please choose account and token based on Account settings before swap or bridge.",
              )}
            </div>

            {bridgeFromUpload && (activeTab === "bridge" || activeTab === "swap") && (
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

            <Tabs
              defaultValue={defaultTab}
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <div className="mb-6 flex items-center justify-between">
                <TabsList className="glass-premium h-12 w-full p-1 sm:w-auto">
                  <TabsTrigger value="swap" className="flex-1 gap-2 sm:w-32">
                    <ArrowRightLeft className="h-4 w-4" />
                    {t("dex.swap", "Swap")}
                  </TabsTrigger>
                  <TabsTrigger value="bridge" className="flex-1 gap-2 sm:w-32">
                    <TrendingUp className="h-4 w-4" />
                    {t("dex.bridge", "Bridge")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="transfer"
                    className="flex-1 gap-2 sm:w-32"
                  >
                    <Send className="h-4 w-4" />
                    {t("dex.transfer", "Send")}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="swap" className="mt-0">
                <SwapCard />
              </TabsContent>

              <TabsContent value="bridge" className="mt-0">
                <BridgeCard />
              </TabsContent>

              <TabsContent value="transfer" className="mt-0">
                <TransferCard />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-6">
            <TransactionHistory />
          </div>
        </div>
      </div>
    </div>
  )
}
// End of component
