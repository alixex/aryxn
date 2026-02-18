import { useState } from "react"
import { TrendingUp, Wallet, ArrowRightLeft, Send } from "lucide-react"
import { useConnection } from "wagmi"
import { useTranslation } from "@/i18n/config"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useWallet } from "@/hooks/account-hooks"
import type { WalletRecord } from "@/lib/utils"
// Components
import { SwapCard } from "@/components/dex/SwapCard"
import { BridgeCard } from "@/components/dex/BridgeCard"
import { TransferCard } from "@/components/dex/TransferCard"
import { TransactionHistory } from "@/components/dex/TransactionHistory"

export default function DexPage() {
  const { t } = useTranslation()
  const { isConnected, address: externalAddress } = useConnection()
  const wallet = useWallet()
  const walletManager = wallet.internal
  const activeEvm = wallet.active.evm

  // Check if internal wallet is available for Ethereum
  const hasInternalEthAccount = !!activeEvm && !activeEvm.isExternal

  const isWalletReady = isConnected || !!activeEvm
  const displayAddress = isConnected ? externalAddress : activeEvm?.address

  // Get active account alias for display
  const activeAccountAlias = wallet.internal.wallets.find(
    (w: WalletRecord) => w.address === walletManager.activeAddress,
  )?.alias

  const [activeTab, setActiveTab] = useState("swap")

  return (
    <div className="mesh-gradient relative min-h-screen">
      <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto max-w-6xl space-y-6 px-3 py-6 duration-1000 sm:space-y-8 sm:px-4 sm:py-8">
        {/* Header Section */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3">
            <h2 className="flex items-center gap-3 text-3xl font-extrabold tracking-tighter sm:text-4xl lg:text-5xl">
              <div className="bg-gradient-secondary glow-gold rounded-xl p-2 text-white shadow-xl ring-1 ring-white/20 sm:rounded-2xl sm:p-2.5">
                <TrendingUp
                  className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8"
                  aria-hidden="true"
                />
              </div>
              <span className="bg-gradient-primary gradient-text leading-tight">
                {t("dex.title")}
              </span>
            </h2>
            <p className="text-subtitle-muted max-w-lg text-base leading-relaxed font-medium">
              {t("dex.description")}
            </p>
          </div>

          {/* Account Status Badge */}
          {isWalletReady && displayAddress ? (
            <div className="glass-premium hover:shadow-primary/5 flex items-center gap-3 border-none p-3 shadow-2xl transition-all duration-500 sm:px-4 sm:py-2">
              <div className="flex-1 sm:text-right">
                <div className="text-muted-foreground mb-0.5 text-[10px] font-bold tracking-wider uppercase">
                  {isConnected
                    ? t("identities.currentAccount")
                    : t("common.activeAccountLabel")}
                </div>
                <div className="text-foreground max-w-45 truncate text-sm font-bold">
                  {hasInternalEthAccount && !isConnected && activeAccountAlias
                    ? activeAccountAlias
                    : displayAddress
                      ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
                      : ""}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-premium hover:shadow-primary/5 flex items-center gap-3 border-none p-3 shadow-2xl transition-all duration-500 sm:px-4 sm:py-2">
              <div className="flex-1 sm:text-right">
                <div className="text-muted-foreground mb-0.5 text-[10px] font-bold tracking-wider uppercase">
                  {t("common.activeAccountLabel")}
                </div>
                <div className="text-foreground text-sm font-bold">
                  {t("common.noAccount")}
                </div>
              </div>
              <Link to="/account" className="sm:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:text-cyan-400"
                  aria-label={t("common.account")}
                >
                  <Wallet
                    className="text-muted-foreground h-4 w-4"
                    aria-hidden="true"
                  />
                </Button>
              </Link>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Action Area */}
          <div className="lg:col-span-2">
            <Tabs
              defaultValue="swap"
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
