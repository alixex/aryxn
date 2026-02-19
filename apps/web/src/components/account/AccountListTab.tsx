import { useState } from "react"
import { toast } from "sonner"
import { db } from "@/lib/database"
import type { BalanceResult } from "@/lib/chain"
import { AccountList } from "@/components/account/AccountList"
import { Chains } from "@aryxn/chain-constants"
import { AccountDeleteDialog } from "@/components/account/AccountDeleteDialog"

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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
          account.chain === Chains.ETHEREUM &&
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
    const disconnectHandlers: Record<string, () => Promise<void> | void> = {
      [Chains.ETHEREUM]: async () => {
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
      },
      [Chains.ARWEAVE]: () => externalWallets.disconnectArweave(),
      [Chains.SOLANA]: () => externalWallets.disconnectSolana(),
      [Chains.SUI]: () => externalWallets.disconnectSui(),
    }

    const handler = disconnectHandlers[account.chain]
    if (handler) await handler()
  }

  const handleDelete = (account: Account) => {
    if (account.isExternal) {
      return
    }
    setPendingDelete(account)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete || pendingDelete.isExternal) {
      return
    }
    if (!walletManager.isUnlocked || !walletManager.vaultId) {
      toast.error(t("identities.exportErrorNoVault"))
      return
    }
    setIsDeleting(true)
    try {
      if (pendingDelete.id) {
        await db.run("DELETE FROM wallets WHERE id = ?", [pendingDelete.id])
      } else {
        await db.run("DELETE FROM wallets WHERE address = ? AND vault_id = ?", [
          pendingDelete.address,
          walletManager.vaultId,
        ])
      }

      if (walletManager.activeAddress === pendingDelete.address) {
        await walletManager.clearActiveWallet()
      }

      await walletManager.refreshWallets()
      toast.success(
        t("identities.deleteAccountSuccess", {
          alias: pendingDelete.alias || pendingDelete.address,
        }),
      )
      setDeleteDialogOpen(false)
      setPendingDelete(null)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(
        t("identities.deleteAccountFailed", { message: errorMessage }),
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <AccountList
        chain={chain}
        accounts={allAccounts}
        isActive={isActive}
        onSelect={handleSelect}
        onCopyAddress={onCopyAddress}
        onShowSensitive={walletManager.isUnlocked ? onShowSensitive : undefined}
        onDisconnect={handleDisconnect}
        onDelete={handleDelete}
        balances={balances}
        loadingBalances={loadingBalances}
        showBalances={showBalances}
        onRefreshBalance={onRefreshBalance}
        onToggleBalance={onToggleBalance}
      />
      <AccountDeleteDialog
        open={deleteDialogOpen}
        account={pendingDelete}
        isDeleting={isDeleting}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setPendingDelete(null)
          }
        }}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
