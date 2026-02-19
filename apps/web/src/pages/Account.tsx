import { useState } from "react"
import { AccountChains } from "@aryxn/chain-constants"
import { useTranslation } from "@/i18n/config"
import { useInternal, useWallet, useAccounts } from "@/hooks/account-hooks"
import { toast } from "sonner"
import { useDisconnect } from "wagmi"

import type { WalletRecord } from "@/lib/utils"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UnlockForm } from "@/components/account/UnlockForm"

import { AddAccountSection } from "@/components/account/AddAccountSection"
import { SensitiveInfoDialog } from "@/components/account/SensitiveInfoDialog"
import { CreateAccountDialog } from "@/components/account/CreateAccountDialog"
import AccountHeader from "@/components/account/AccountHeader"
import AccountSidebar from "@/components/account/AccountSidebar"
import { AccountListTab } from "@/components/account/AccountListTab"

export default function AccountPage() {
  const { t } = useTranslation()
  const walletManager = useInternal()
  const wallet = useWallet()
  const { mutate: disconnectEVM } = useDisconnect()

  // 使用外部钱包状态 (已聚合进 wallet.external)
  const externalWallets = wallet.external

  // 敏感信息对话框
  const [showSensitiveDialog, setShowSensitiveDialog] = useState(false)
  const [sensitiveAccount, setSensitiveAccount] = useState<WalletRecord | null>(
    null,
  )
  const [viewType, setViewType] = useState<"key" | "mnemonic">("key")

  // 创建账户对话框
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createChain, setCreateChain] = useState<string>("")

  const {
    getExternalAccounts,
    balances,
    loadingBalances,
    showBalances,
    refreshBalance,
    toggleShowBalance,
  } = useAccounts()

  // 处理函数
  const handleUnlock = async (password: string) => {
    return await walletManager.unlock(password)
  }

  const handleAddAccount = async (input: string, alias: string) => {
    if (!input || !alias) {
      toast.error(t("identities.keyPlaceholder"))
      return
    }
    await walletManager.addWallet(input, alias)
  }

  const handleCreateAccount = async (chain: string) => {
    setCreateChain(chain)
    setShowCreateDialog(true)
  }

  const handleConfirmCreateAccount = async (alias: string) => {
    await walletManager.createWallet(
      createChain as WalletRecord["chain"],
      alias,
    )
  }

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    toast.success(
      t("identities.copySuccess", {
        address: `${address.slice(0, 6)}...${address.slice(-4)}`,
      }),
    )
  }

  const handleShowSensitive = (
    account: {
      id?: string | number
      chain: string
      address: string
      alias: string
      isExternal: boolean
      encryptedKey?: string
      vaultId?: string
      createdAt?: number
    },
    type: "key" | "mnemonic",
  ) => {
    // 只处理非外部账户
    if (
      account.isExternal ||
      !account.encryptedKey ||
      !account.vaultId ||
      account.createdAt === undefined
    ) {
      return
    }
    const walletRecord: WalletRecord = {
      id: typeof account.id === "number" ? account.id : undefined,
      address: account.address,
      encryptedKey: account.encryptedKey,
      alias: account.alias,
      chain: account.chain as WalletRecord["chain"],
      vaultId: account.vaultId,
      createdAt: account.createdAt,
    }
    setSensitiveAccount(walletRecord)
    setViewType(type)
    setShowSensitiveDialog(true)
  }

  const verifyAndShow = async (password: string) => {
    if (!sensitiveAccount) {
      return null
    }
    try {
      const info = await walletManager.getDecryptedInfo(
        sensitiveAccount,
        password,
      )
      return info
    } catch {
      toast.error(t("unlock.incorrect"))
      return null
    }
  }

  return (
    <div className="mesh-gradient relative min-h-screen">
      <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto max-w-6xl space-y-6 px-3 py-6 duration-1000 sm:space-y-8 sm:px-4 sm:py-8">
        <AccountHeader
          t={t}
          isUnlocked={walletManager.isUnlocked}
          onLogout={walletManager.logout}
        />

        {!walletManager.isUnlocked ? (
          <div className="px-4 sm:px-0">
            <UnlockForm onUnlock={handleUnlock} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3">
            <div className="space-y-6 sm:space-y-8 lg:col-span-2">
              <Card className="glass-premium hover:shadow-primary/5 border-none shadow-2xl transition-all duration-500">
                <CardHeader className="glass-strong animate-fade-in-down border-accent/30 bg-card/60 flex flex-col space-y-1.5 rounded-t-2xl border-b-2 p-6 shadow-lg">
                  <CardTitle className="text-foreground text-base">
                    {t("identities.title")}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground text-xs">
                    {t("identities.desc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Tabs defaultValue={AccountChains[0]} className="w-full">
                    <div className="overflow-x-auto px-4 pt-4 sm:px-6">
                      <TabsList className="bg-muted mb-0 flex h-auto w-max flex-nowrap justify-start gap-1 rounded-lg p-1 sm:w-auto sm:flex-wrap">
                        {AccountChains.map((chain) => (
                          <TabsTrigger
                            key={chain}
                            value={chain}
                            className="data-[state=active]:bg-background rounded-md px-4 py-2 text-xs font-semibold capitalize data-[state=active]:text-cyan-400 data-[state=active]:shadow-sm"
                          >
                            {chain}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>
                    {AccountChains.map((chain) => (
                      <TabsContent
                        key={chain}
                        value={chain}
                        className="px-4 pt-4 pb-4 sm:px-6 sm:pb-6"
                      >
                        <AccountListTab
                          chain={chain}
                          wallet={wallet}
                          walletManager={walletManager}
                          externalWallets={externalWallets}
                          getExternalAccounts={getExternalAccounts}
                          onShowSensitive={handleShowSensitive}
                          onCopyAddress={copyAddress}
                          onDisconnectEVM={disconnectEVM}
                          t={t}
                          balances={balances}
                          loadingBalances={loadingBalances}
                          showBalances={showBalances}
                          onRefreshBalance={refreshBalance}
                          onToggleBalance={toggleShowBalance}
                        />
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>

              <div className="px-4 sm:px-0">
                <AddAccountSection
                  onAddAccount={handleAddAccount}
                  onCreateAccount={handleCreateAccount}
                />
              </div>
            </div>

            <AccountSidebar t={t} walletManager={walletManager} />
          </div>
        )}

        <SensitiveInfoDialog
          open={showSensitiveDialog}
          onOpenChange={setShowSensitiveDialog}
          account={sensitiveAccount}
          type={viewType}
          onVerify={verifyAndShow}
        />

        <CreateAccountDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          chain={createChain}
          onConfirm={handleConfirmCreateAccount}
        />
      </div>
    </div>
  )
}
