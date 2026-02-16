import { useState } from "react"
import { useTranslation } from "@/i18n/config"
import { useWallet } from "@/hooks/use-wallet"
import { toast } from "sonner"
import { useDisconnect } from "wagmi"
import useAccounts from "@/hooks/useAccounts"
import { db } from "@/lib/sqlite-db"
import type { WalletRecord } from "@/lib/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UnlockForm } from "@/components/account/UnlockForm"
import { AccountList } from "@/components/account/AccountList"
import { AddAccountSection } from "@/components/account/AddAccountSection"
import { SensitiveInfoDialog } from "@/components/account/SensitiveInfoDialog"
import { CreateAccountDialog } from "@/components/account/CreateAccountDialog"
import AccountHeader from "@/components/account/AccountHeader"
import AccountSidebar from "@/components/account/AccountSidebar"

export default function AccountPage() {
  const { t } = useTranslation()
  const wallet = useWallet()
  const walletManager = wallet.internal
  const { mutate: disconnectEVM } = useDisconnect()

  // 使用外部钱包 hook (已聚合进 wallet.external)
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

  // refreshBalance provided by useAccounts

  // 渲染账户列表
  const renderAccountList = (chain: string) => {
    type Account = {
      id?: string | number
      chain: string
      address: string
      alias: string
      isExternal: boolean
      encryptedKey?: string
      vaultId?: string
      createdAt?: number
    }

    const localAccounts = wallet.getLocalAccounts
      ? wallet.getLocalAccounts(chain)
      : walletManager.wallets
          .filter((w) => w.chain === chain)
          .map((w) => ({ ...w, id: w.id ?? undefined, isExternal: false }))
    const externalAccounts = wallet.getExternalAccounts
      ? wallet.getExternalAccounts(chain)
      : getExternalAccounts().filter((acc) => acc.chain === chain)
    const allAccounts = wallet.getAllAccounts
      ? (wallet.getAllAccounts(chain) as Account[])
      : ([...localAccounts, ...externalAccounts] as Account[])

    const isActive = (account: Account) => {
      const activeAccounts = wallet.active?.accounts || []
      const addrLower = account.address?.toLowerCase()
      if (!addrLower) return false

      // If any synthesized active account has the same address, consider it active
      if (
        activeAccounts.some((a: any) => a.address?.toLowerCase() === addrLower)
      ) {
        return true
      }

      // Fallback: internal active address equality
      return walletManager.activeAddress === account.address
    }

    const handleSelect = (account: Account) => {
      if (account.isExternal) {
        if (!isActive(account)) {
          if (
            account.chain === "ethereum" &&
            account.address.toLowerCase() !==
              externalWallets.paymentAddress?.toLowerCase()
          ) {
            toast.info(t("identities.switchAccountHint"), {
              duration: 2000,
            })
          } else {
            walletManager.clearActiveWallet()
            toast.success(t("identities.switchedToExternal"))
          }
        }
      } else {
        if (!isActive(account)) {
          walletManager.selectWallet(account.address)
        }
      }
    }

    const handleDisconnect = async (account: Account) => {
      if (account.chain === "ethereum") {
        disconnectEVM()
        if (!walletManager.activeAddress && walletManager.vaultId) {
          try {
            await db.run("DELETE FROM vault_metadata WHERE key = ?", [
              `use_external_${walletManager.vaultId}`,
            ])
          } catch (e) {
            console.error("Failed to clear external account state:", e)
          }
        }
      } else if (account.chain === "arweave") {
        externalWallets.disconnectArweave()
      } else if (account.chain === "solana") {
        externalWallets.disconnectSolana()
      } else if (account.chain === "sui") {
        externalWallets.disconnectSui()
      }
    }

    return (
      <AccountList
        chain={chain}
        accounts={allAccounts}
        isActive={isActive}
        onSelect={handleSelect}
        onCopyAddress={copyAddress}
        onShowSensitive={walletManager.isUnlocked ? handleShowSensitive : undefined}
        onDisconnect={handleDisconnect}
      />
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-4 sm:space-y-8 sm:py-8">
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
            <Card className="border-border overflow-hidden shadow-sm sm:rounded-2xl">
              <CardHeader className="border-border bg-secondary/50 border-b pb-3 sm:px-6">
                <CardTitle className="text-foreground text-base">
                  {t("identities.title")}
                </CardTitle>
                <CardDescription className="text-muted-foreground text-xs">
                  {t("identities.desc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs defaultValue="ethereum" className="w-full">
                  <div className="overflow-x-auto px-4 pt-4 sm:px-6">
                    <TabsList className="bg-muted mb-0 flex h-auto w-max flex-nowrap justify-start gap-1 rounded-lg p-1 sm:w-auto sm:flex-wrap">
                      {["ethereum", "bitcoin", "solana", "sui", "arweave"].map(
                        (chain) => (
                          <TabsTrigger
                            key={chain}
                            value={chain}
                            className="data-[state=active]:bg-background data-[state=active]:text-foreground rounded-md px-4 py-2 text-xs font-semibold capitalize data-[state=active]:shadow-sm"
                          >
                            {chain}
                          </TabsTrigger>
                        ),
                      )}
                    </TabsList>
                  </div>
                  <TabsContent
                    value="ethereum"
                    className="px-4 pt-4 pb-4 sm:px-6 sm:pb-6"
                  >
                    {renderAccountList("ethereum")}
                  </TabsContent>
                  <TabsContent
                    value="bitcoin"
                    className="px-4 pt-4 pb-4 sm:px-6 sm:pb-6"
                  >
                    {renderAccountList("bitcoin")}
                  </TabsContent>
                  <TabsContent
                    value="solana"
                    className="px-4 pt-4 pb-4 sm:px-6 sm:pb-6"
                  >
                    {renderAccountList("solana")}
                  </TabsContent>
                  <TabsContent
                    value="sui"
                    className="px-4 pt-4 pb-4 sm:px-6 sm:pb-6"
                  >
                    {renderAccountList("sui")}
                  </TabsContent>
                  <TabsContent
                    value="arweave"
                    className="px-4 pt-4 pb-4 sm:px-6 sm:pb-6"
                  >
                    {renderAccountList("arweave")}
                  </TabsContent>
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
  )
}
