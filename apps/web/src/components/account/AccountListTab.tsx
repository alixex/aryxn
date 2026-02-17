import { toast } from "sonner"
import { db } from "@/lib/database"
import type { BalanceResult } from "@/lib/chain"
import { AccountList } from "@/components/account/AccountList"

export interface Account {
  id?: string | number
  chain: string
  address: string
  alias: string
  isExternal: boolean
  encryptedKey?: string
  vaultId?: string
  createdAt?: number
}

interface AccountListTabProps {
  chain: string
  wallet: any
  walletManager: any
  externalWallets: any
  getExternalAccounts: () => any[]
  onShowSensitive: (account: any, type: "key" | "mnemonic") => void
  onCopyAddress: (address: string) => void
  onDisconnectEVM: () => void
  t: any
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

export function AccountListTab({
  chain,
  wallet,
  walletManager,
  externalWallets,
  getExternalAccounts,
  onShowSensitive,
  onCopyAddress,
  onDisconnectEVM,
  t,
  balances,
  loadingBalances,
  showBalances,
  onRefreshBalance,
  onToggleBalance,
}: AccountListTabProps) {
  const localAccounts = wallet.getLocalAccounts
    ? wallet.getLocalAccounts(chain)
    : walletManager.wallets
        .filter((w: any) => w.chain === chain)
        .map((w: any) => ({ ...w, id: w.id ?? undefined, isExternal: false }))

  const externalAccounts = wallet.getExternalAccounts
    ? wallet.getExternalAccounts(chain)
    : getExternalAccounts().filter((acc) => acc.chain === chain)

  const allAccounts = [
    ...(localAccounts || []),
    ...(externalAccounts || []),
  ] as Account[]

  const isActive = (account: Account) => {
    const activeAccounts = wallet.active?.accounts || []
    const addrLower = account.address?.toLowerCase()
    if (!addrLower) return false

    if (
      activeAccounts.some((a: any) => a.address?.toLowerCase() === addrLower)
    ) {
      return true
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
      onDisconnectEVM()
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
      onCopyAddress={onCopyAddress}
      onShowSensitive={walletManager.isUnlocked ? onShowSensitive : undefined}
      onDisconnect={handleDisconnect}
      balances={balances}
      loadingBalances={loadingBalances}
      showBalances={showBalances}
      onRefreshBalance={onRefreshBalance}
      onToggleBalance={onToggleBalance}
    />
  )
}
