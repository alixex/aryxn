import { useEffect, useState } from "react"
import { AccountChains } from "@aryxn/chain-constants"
import { useTranslation } from "@/i18n/config"
import { useWallet, useAccounts } from "@/hooks/account-hooks"
import { toast } from "sonner"

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
import {
  hasValidPasswordVerificationSession,
  markPasswordVerificationSession,
} from "@/lib/security/password-verification-session"

export default function AccountPage() {
  const { t } = useTranslation()
  const wallet = useWallet()
  const walletManager = wallet.internal

  // 敏感信息对话框
  const [showSensitiveDialog, setShowSensitiveDialog] = useState(false)
  const [sensitiveAccount, setSensitiveAccount] = useState<WalletRecord | null>(
    null,
  )
  const [viewType, setViewType] = useState<"key" | "mnemonic">("key")

  // 创建账户对话框
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createChain, setCreateChain] = useState<string>("")
  const [passwordSessionVerified, setPasswordSessionVerified] = useState(false)

  const {
    balances,
    loadingBalances,
    showBalances,
    refreshBalance,
    toggleShowBalance,
  } = useAccounts()

  useEffect(() => {
    const syncVerificationSession = async () => {
      if (
        !walletManager.isUnlocked ||
        !walletManager.masterKey ||
        !walletManager.vaultId
      ) {
        setPasswordSessionVerified(false)
        return
      }

      const valid = await hasValidPasswordVerificationSession(
        walletManager.masterKey,
        walletManager.vaultId,
      )
      setPasswordSessionVerified(valid)
    }

    void syncVerificationSession()
  }, [walletManager.isUnlocked, walletManager.masterKey, walletManager.vaultId])

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
      const info = passwordSessionVerified
        ? await walletManager.getDecryptedInfoWithMasterKey(sensitiveAccount)
        : await walletManager.getDecryptedInfo(sensitiveAccount, password)

      if (
        !passwordSessionVerified &&
        walletManager.masterKey &&
        walletManager.vaultId
      ) {
        await markPasswordVerificationSession(
          walletManager.masterKey,
          walletManager.vaultId,
        )
        setPasswordSessionVerified(true)
      }

      return info
    } catch {
      toast.error(t("unlock.incorrect"))
      return null
    }
  }

  return (
    <div className="mesh-gradient relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.1),transparent_62%)]" />
      <div className="pointer-events-none absolute top-24 right-0 h-64 w-64 rounded-full bg-[hsl(var(--accent)/0.1)] blur-3xl" />
      <div className="animate-in fade-in slide-in-from-bottom-2 relative mx-auto max-w-7xl space-y-6 px-4 py-6 duration-700 sm:space-y-8 sm:px-6 sm:py-8 lg:space-y-10 lg:px-8 lg:py-10">
        <AccountHeader
          t={t}
          isUnlocked={walletManager.isUnlocked}
          onLogout={walletManager.logout}
        />

        {!walletManager.isUnlocked ? (
          <div className="mx-auto w-full max-w-2xl">
            <UnlockForm onUnlock={handleUnlock} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.95fr)] lg:items-start lg:gap-8">
            <div className="space-y-6 lg:space-y-8">
              <Card className="border-border/70 bg-card/90 overflow-hidden rounded-[28px] border shadow-[0_16px_40px_-30px_hsl(220_35%_2%/0.55)] transition-all duration-200">
                <CardHeader className="animate-fade-in-down border-border/70 flex flex-col gap-2 border-b bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--card)/0.92)_100%)] px-5 py-5 sm:px-6 sm:py-6">
                  <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.28em] uppercase">
                    {t("common.account")}
                  </div>
                  <CardTitle className="text-foreground text-lg font-semibold tracking-tight sm:text-xl">
                    {t("identities.title")}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground/90 max-w-2xl text-sm leading-relaxed">
                    {t("identities.desc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Tabs defaultValue={AccountChains[0]} className="w-full">
                    <div className="overflow-x-auto px-4 pt-4 sm:px-6 sm:pt-5">
                      <TabsList className="border-border/60 mb-0 flex h-auto min-w-full flex-nowrap justify-start gap-1.5 rounded-2xl border bg-[hsl(var(--background)/0.52)] p-1.5 sm:w-fit sm:min-w-0">
                        {AccountChains.map((chain) => (
                          <TabsTrigger
                            key={chain}
                            value={chain}
                            className="data-[state=active]:bg-card data-[state=active]:text-primary cursor-pointer rounded-xl px-4 py-2.5 text-xs font-semibold capitalize transition-all duration-200 data-[state=active]:shadow-[0_12px_28px_-18px_hsl(220_35%_2%/0.72)]"
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
                        className="px-4 pt-4 pb-4 sm:px-6 sm:pt-5 sm:pb-6"
                      >
                        <AccountListTab
                          chain={chain}
                          wallet={wallet}
                          walletManager={walletManager}
                          onShowSensitive={handleShowSensitive}
                          onCopyAddress={copyAddress}
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

              <AddAccountSection
                onAddAccount={handleAddAccount}
                onCreateAccount={handleCreateAccount}
              />
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
          passwordOptional={passwordSessionVerified}
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
