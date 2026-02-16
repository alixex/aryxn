import { useState, useEffect, useCallback, useRef } from "react"
import { useTranslation } from "@/i18n/config"
import { useWallet } from "@/hooks/use-wallet"
import { toast } from "sonner"
import { useConnection, useDisconnect } from "wagmi"
import { getBalance, type BalanceResult } from "@/lib/balance"
import { db } from "@/lib/sqlite-db"
import { LogOut, ShieldCheck, Info } from "lucide-react"
import type { WalletRecord } from "@/lib/types"
import { Button } from "@/components/ui/button"
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
import { ConfigImportExport } from "@/components/account/ConfigImportExport"
import { CreateAccountDialog } from "@/components/account/CreateAccountDialog"

export default function AccountPage() {
  const { t } = useTranslation()
  const wallet = useWallet()
  const walletManager = wallet.internal
  const { connector } = useConnection()
  const { disconnect: disconnectEVM } = useDisconnect()

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

  // 余额状态
  const [balances, setBalances] = useState<
    Record<string, BalanceResult | null>
  >({})
  const [loadingBalances, setLoadingBalances] = useState<
    Record<string, boolean>
  >({})
  const [showBalances, setShowBalances] = useState<Record<string, boolean>>({})

  // 使用 ref 来跟踪已经加载过的余额，避免重复加载
  const fetchedBalancesRef = useRef<Set<string>>(new Set())

  // 获取所有账户的余额
  useEffect(() => {
    if (!walletManager.isUnlocked || walletManager.wallets.length === 0) {
      return
    }

    const fetchBalances = async () => {
      for (const wallet of walletManager.wallets) {
        const key = `${wallet.chain}-${wallet.address}`

        // 如果已经加载过，跳过
        if (fetchedBalancesRef.current.has(key)) {
          continue
        }

        // 标记为已加载
        fetchedBalancesRef.current.add(key)

        setLoadingBalances((prev) => ({ ...prev, [key]: true }))
        try {
          const balance = await getBalance(wallet.chain, wallet.address)
          setBalances((prev) => ({ ...prev, [key]: balance }))
        } catch (error) {
          console.error(`Failed to fetch balance for ${wallet.address}:`, error)
          setBalances((prev) => ({
            ...prev,
            [key]: {
              balance: "0",
              formatted: "0",
              symbol: wallet.chain.toUpperCase(),
              error: "Failed to fetch",
            },
          }))
        } finally {
          setLoadingBalances((prev) => ({ ...prev, [key]: false }))
        }
      }
    }

    fetchBalances()
    // 只在钱包状态变化时触发，不依赖 balances
  }, [walletManager.isUnlocked, walletManager.wallets.length])

  // 获取外部连接的账户信息
  const getExternalAccounts = useCallback(() => {
    const externalAccounts: Array<{
      id: string
      chain: string
      address: string
      alias: string
      isExternal: true
      provider?: string
    }> = []

    // EVM 账户
    if (
      externalWallets.isPaymentConnected &&
      externalWallets.allEVMAddresses &&
      Array.isArray(externalWallets.allEVMAddresses) &&
      externalWallets.allEVMAddresses.length > 0
    ) {
      externalWallets.allEVMAddresses.forEach((address) => {
        if (address && typeof address === "string") {
          const isActive =
            address.toLowerCase() ===
            externalWallets.paymentAddress?.toLowerCase()
          externalAccounts.push({
            id: `external-evm-${address}`,
            chain: "ethereum",
            address: address,
            alias: isActive
              ? t("identities.evmWalletCurrent")
              : t("identities.evmWalletAddress", {
                  address: `${address.slice(0, 6)}...${address.slice(-4)}`,
                }),
            isExternal: true,
            provider: "EVM",
          })
        }
      })
    }

    // Arweave 账户
    if (externalWallets.isArConnected && externalWallets.arAddress) {
      externalAccounts.push({
        id: `external-arweave-${externalWallets.arAddress}`,
        chain: "arweave",
        address: externalWallets.arAddress,
        alias: t("identities.arconnectWallet"),
        isExternal: true,
        provider: "ArConnect",
      })
    }

    // Solana 账户
    if (externalWallets.isSolConnected && externalWallets.solAddress) {
      externalAccounts.push({
        id: `external-solana-${externalWallets.solAddress}`,
        chain: "solana",
        address: externalWallets.solAddress,
        alias: t("identities.phantomWallet"),
        isExternal: true,
        provider: "Phantom",
      })
    }

    // Sui 账户
    if (externalWallets.isSuiConnected && externalWallets.suiAddress) {
      externalAccounts.push({
        id: `external-sui-${externalWallets.suiAddress}`,
        chain: "sui",
        address: externalWallets.suiAddress,
        alias: t("identities.suiWallet"),
        isExternal: true,
        provider: "Sui Wallet",
      })
    }

    return externalAccounts
  }, [externalWallets, t])

  // 获取外部账户余额
  useEffect(() => {
    const externalAccounts = getExternalAccounts()
    if (externalAccounts.length === 0) return

    const fetchExternalBalances = async () => {
      for (const account of externalAccounts) {
        const key = `external-${account.chain}-${account.address}`

        // 如果已经加载过，跳过
        if (fetchedBalancesRef.current.has(key)) {
          continue
        }

        // 标记为已加载
        fetchedBalancesRef.current.add(key)

        setLoadingBalances((prev) => ({ ...prev, [key]: true }))
        try {
          const balance = await getBalance(account.chain, account.address)
          setBalances((prev) => ({ ...prev, [key]: balance }))
        } catch (error) {
          console.error(
            `Failed to fetch balance for external ${account.address}:`,
            error,
          )
          setBalances((prev) => ({
            ...prev,
            [key]: {
              balance: "0",
              formatted: "0",
              symbol: account.chain.toUpperCase(),
              error: "Failed to fetch",
            },
          }))
        } finally {
          setLoadingBalances((prev) => ({ ...prev, [key]: false }))
        }
      }
    }

    fetchExternalBalances()
  }, [
    externalWallets.isPaymentConnected,
    externalWallets.paymentAddress,
    externalWallets.isArConnected,
    externalWallets.arAddress,
    externalWallets.isSolConnected,
    externalWallets.solAddress,
    externalWallets.isSuiConnected,
    externalWallets.suiAddress,
    getExternalAccounts,
  ])

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

  const refreshBalance = async (
    chain: string,
    address: string,
    isExternal = false,
  ) => {
    const key = isExternal
      ? `external-${chain}-${address}`
      : `${chain}-${address}`

    // 移除已加载标记，允许重新加载
    fetchedBalancesRef.current.delete(key)

    setLoadingBalances((prev) => ({ ...prev, [key]: true }))
    try {
      const balance = await getBalance(chain, address)
      setBalances((prev) => ({ ...prev, [key]: balance }))
      // 重新标记为已加载
      fetchedBalancesRef.current.add(key)
    } catch (error) {
      console.error(`Failed to fetch balance for ${address}:`, error)
      setBalances((prev) => ({
        ...prev,
        [key]: {
          balance: "0",
          formatted: "0",
          symbol: chain.toUpperCase(),
          error: "Failed to fetch",
        },
      }))
    } finally {
      setLoadingBalances((prev) => ({ ...prev, [key]: false }))
    }
  }

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

    const localAccounts = walletManager.wallets.filter((w) => w.chain === chain)
    const externalAccounts = getExternalAccounts().filter(
      (acc) => acc.chain === chain,
    )

    const allAccounts: Account[] = [
      ...localAccounts.map((w) => ({
        ...w,
        id: w.id ?? undefined,
        isExternal: false,
      })),
      ...externalAccounts.map((acc) => ({
        ...acc,
        alias:
          acc.chain === "ethereum"
            ? t("identities.evmWallet")
            : acc.chain === "arweave"
              ? t("identities.arconnectWallet")
              : acc.chain === "solana"
                ? t("identities.phantomWallet")
                : acc.chain === "sui"
                  ? t("identities.suiWallet")
                  : t("identities.externalAccount"),
      })),
    ]

    const isActive = (account: Account) => {
      if (account.isExternal) {
        return (
          !walletManager.activeAddress &&
          (account.chain === "ethereum"
            ? account.address.toLowerCase() ===
              externalWallets.paymentAddress?.toLowerCase()
            : account.chain === "arweave"
              ? account.address === externalWallets.arAddress
              : account.chain === "solana"
                ? account.address === externalWallets.solAddress
                : account.chain === "sui"
                  ? account.address === externalWallets.suiAddress
                  : true)
        )
      }
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
        balances={balances}
        loadingBalances={loadingBalances}
        showBalances={showBalances}
        isActive={isActive}
        onSelect={handleSelect}
        onCopyAddress={copyAddress}
        onShowSensitive={
          walletManager.isUnlocked ? handleShowSensitive : undefined
        }
        onDisconnect={handleDisconnect}
        onToggleBalance={(key, show) => {
          setShowBalances((prev) => ({ ...prev, [key]: show }))
        }}
        onRefreshBalance={(chain, address, isExternal) =>
          refreshBalance(chain, address, isExternal)
        }
        isPaymentConnected={externalWallets.isPaymentConnected}
        connector={connector || undefined}
        paymentAddress={externalWallets.paymentAddress || undefined}
      />
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-4 sm:space-y-8 sm:py-8">
      <div className="flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-0">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("common.account")}
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t("identities.multiChainDesc")}
          </p>
        </div>
        {walletManager.isUnlocked && (
          <Button
            variant="outline"
            size="sm"
            onClick={walletManager.logout}
            className="border-destructive/30 text-destructive hover:bg-destructive/10 w-full sm:w-auto"
          >
            <LogOut className="mr-2 h-4 w-4" /> {t("identities.logout")}
          </Button>
        )}
      </div>

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
                isPaymentConnected={externalWallets.isPaymentConnected}
                paymentAddress={externalWallets.paymentAddress || undefined}
                allEVMAddresses={externalWallets.allEVMAddresses}
                isArConnected={externalWallets.isArConnected}
                arAddress={externalWallets.arAddress}
                connectArweave={externalWallets.connectArweave}
                isSolConnected={externalWallets.isSolConnected}
                solAddress={externalWallets.solAddress}
                connectSolana={externalWallets.connectSolana}
                disconnectSolana={externalWallets.disconnectSolana}
                isSuiConnected={externalWallets.isSuiConnected}
                suiAddress={externalWallets.suiAddress}
                connectSui={externalWallets.connectSui}
                disconnectSui={externalWallets.disconnectSui}
              />
            </div>
          </div>

          <div className="space-y-6 px-4 sm:px-0">
            <div className="border-border bg-card rounded-2xl border p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-3">
                <div className="bg-secondary text-foreground rounded-lg p-2">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="text-foreground font-bold">
                  {t("identities.activeVault")}
                </h3>
              </div>
              <div className="text-muted-foreground font-mono text-xs break-all">
                ID: {walletManager.vaultId}
              </div>
              <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                {t("identities.vaultDesc")}
              </p>
            </div>

            <div className="border-border bg-card rounded-2xl border p-6 sm:p-8">
              <h3 className="text-foreground mb-3 flex items-center gap-2 font-bold">
                <Info className="text-muted-foreground h-4 w-4" />{" "}
                {t("identities.securityInfo")}
              </h3>
              <ul className="text-muted-foreground space-y-3 text-xs leading-relaxed">
                <li>• {t("identities.securityItem1")}</li>
                <li>• {t("identities.securityItem2")}</li>
                <li>• {t("identities.securityItem3")}</li>
              </ul>
            </div>

            <div className="px-4 sm:px-0">
              <ConfigImportExport />
            </div>
          </div>
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
