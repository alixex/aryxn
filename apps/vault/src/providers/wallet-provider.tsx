import {
  createContext,
  useContext,
  type ReactNode,
  useCallback,
  useMemo,
} from "react"
import { getBalance, type BalanceResult } from "@/lib/chain"
import { useVault } from "@/hooks/vault-hooks"
import { useWalletStorage } from "@/hooks/vault-hooks"
import { useWalletOps } from "@/hooks/vault-hooks"
import { AccountChains, Chains } from "@aryxn/chain-constants"
import { clearPasswordVerificationSession } from "@/lib/security/password-verification-session"
import type {
  WalletRecord,
  WalletKey,
  ActiveAccount,
  DecryptedData,
} from "@aryxn/wallet-core"

// Standardized account shape exposed by the provider
export type AccountInfo = {
  id?: string | number
  chain: string
  address: string
  alias?: string
  isExternal: boolean
  provider?: string
}

// Helper: build local accounts from storage for a chain
function buildLocalForChain(
  storage: ReturnType<typeof useWalletStorage>,
  chain: string,
): AccountInfo[] {
  return storage.wallets
    .filter((w: WalletRecord) => w.chain === chain)
    .map((w: WalletRecord) => ({
      id: w.id ?? undefined,
      chain: w.chain,
      address: w.address,
      alias: (w as any).alias ?? undefined,
      isExternal: false,
    }))
}

interface WalletContextType {
  // Unified Active Account (internal only now)
  active: {
    accounts: ActiveAccount[]
    arweave?: ActiveAccount
    solana?: ActiveAccount
    sui?: ActiveAccount
    evm?: ActiveAccount
    hasAny: boolean
  }

  // Internal Wallet (Vault)
  internal: {
    wallets: WalletRecord[]
    isUnlocked: boolean
    activeAddress: string | null
    activeWallet: WalletKey | null
    vaultId: string | null
    masterKey: Uint8Array | null
    hasSavedLocalAccount: boolean
    systemSalt: Uint8Array | null
    unlock: (password: string) => Promise<boolean>
    logout: () => void
    addWallet: (
      input: WalletKey | string,
      alias: string,
      chainHint?: string,
    ) => Promise<void>
    createWallet: (chain: WalletRecord["chain"], alias: string) => Promise<void>
    selectWallet: (address: string) => Promise<void>
    clearActiveWallet: () => void
    refreshWallets: () => Promise<void>
    getDecryptedInfo: (
      wallet: WalletRecord,
      passwordConfirm: string,
    ) => Promise<DecryptedData>
    getDecryptedInfoWithMasterKey: (
      wallet: WalletRecord,
    ) => Promise<DecryptedData>
  }

  // Helpers to retrieve accounts by chain
  getLocalAccounts: (chain: string) => AccountInfo[]

  // Refresh balance for an account
  refreshBalance: (
    chain: string,
    address: string,
  ) => Promise<BalanceResult | null>

  // Return mapping of chain -> accounts
  getAccountsByChain: () => Record<string, AccountInfo[]>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: ReactNode }) {
  // 1. Vault Management (Internal)
  const vault = useVault()

  // 2. Storage Management (Internal)
  const storage = useWalletStorage(vault.vaultId, vault.masterKey)

  // 3. Wallet Operations (Internal)
  const ops = useWalletOps()

  // --- Actions ---

  const logout = useCallback(async () => {
    await storage.clearPersistence()
    clearPasswordVerificationSession()
    vault.clearVault()
  }, [storage, vault])

  const addWallet = useCallback(
    async (input: WalletKey | string, alias: string, chainHint?: string) => {
      if (!vault.masterKey || !vault.vaultId) return
      await ops.addWalletLogic(
        input,
        alias,
        vault.masterKey,
        vault.vaultId,
        chainHint,
      )
      await storage.loadWallets()
    },
    [vault.masterKey, vault.vaultId, ops, storage],
  )

  const createWallet = useCallback(
    async (chain: WalletRecord["chain"], alias: string) => {
      if (!vault.masterKey || !vault.vaultId) return
      await ops.createWalletLogic(chain, alias, vault.masterKey, vault.vaultId)
      await storage.loadWallets()
    },
    [vault.masterKey, vault.vaultId, ops, storage],
  )

  const selectWallet = useCallback(
    async (address: string) => {
      await storage.saveActiveAccount(address, false)
    },
    [storage],
  )

  const clearActiveWallet = useCallback(async () => {
    await storage.saveActiveAccount(null, true)
  }, [storage])

  const refreshWallets = useCallback(async () => {
    await storage.loadWallets()
  }, [storage])

  // --- Internal Active Account Synthesis ---

  const active = useMemo(() => {
    const accounts: ActiveAccount[] = []

    // Internal wallets only
    if (vault.isUnlocked && storage.activeAddress) {
      const activeIntWallet = storage.wallets.find(
        (w: WalletRecord) => w.address === storage.activeAddress,
      )
      if (activeIntWallet) {
        const evmChains = [
          Chains.ETHEREUM,
          Chains.POLYGON,
          Chains.BSC,
          Chains.AVALANCHE,
          Chains.ARBITRUM,
          Chains.OPTIMISM,
          Chains.BASE,
          "linea",
          "scroll",
        ]

        const chain = activeIntWallet.chain as any

        if (chain === Chains.ARWEAVE) {
          accounts.push({
            address: activeIntWallet.address,
            chain: "arweave",
            isExternal: false,
          })
        } else if (chain === Chains.SOLANA) {
          accounts.push({
            address: activeIntWallet.address,
            chain: "solana",
            isExternal: false,
          })
        } else if (chain === Chains.SUI) {
          accounts.push({
            address: activeIntWallet.address,
            chain: "sui",
            isExternal: false,
          })
        } else if (evmChains.includes(chain)) {
          accounts.push({
            address: activeIntWallet.address,
            chain: (chain === Chains.ETHEREUM ? "ethereum" : chain) as any,
            isExternal: false,
          })
        }
      }
    }

    return {
      accounts,
      arweave: accounts.find((acc) => acc.chain === "arweave"),
      solana: accounts.find((acc) => acc.chain === "solana"),
      sui: accounts.find((acc) => acc.chain === "sui"),
      evm: accounts.find((acc) =>
        ["ethereum", "polygon", "bsc", "avalanche"].includes(acc.chain),
      ),
      hasAny: accounts.length > 0,
    }
  }, [vault.isUnlocked, storage.activeAddress, storage.wallets])

  const getLocalAccounts = useCallback(
    (chain: string): AccountInfo[] => buildLocalForChain(storage, chain),
    [storage],
  )

  const getAccountsByChain = useCallback((): Record<string, AccountInfo[]> => {
    const out: Record<string, AccountInfo[]> = {}
    for (const c of AccountChains) out[c] = getLocalAccounts(c)
    // Add additional supported chains if they are not in AccountChains but supported for payment
    const extraChains = [Chains.POLYGON, Chains.BSC, Chains.AVALANCHE]
    for (const c of extraChains) {
      if (!out[c]) out[c] = getLocalAccounts(c)
    }
    return out
  }, [getLocalAccounts])

  const refreshBalanceCb = useCallback(
    async (chain: string, address: string): Promise<BalanceResult | null> => {
      try {
        const bal = await getBalance(chain as any, address, {
          forceRefresh: true,
        })
        if (bal) {
          bal.timestamp = Date.now()
        }
        return bal
      } catch (e) {
        console.error("refreshBalance failed", e)
        return null
      }
    },
    [],
  )

  const internalObj = useMemo<WalletContextType["internal"]>(
    () => ({
      wallets: storage.wallets,
      isUnlocked: vault.isUnlocked,
      activeAddress: storage.activeAddress,
      activeWallet: storage.activeWallet,
      vaultId: vault.vaultId,
      masterKey: vault.masterKey,
      hasSavedLocalAccount: storage.hasSavedLocalAccount,
      systemSalt: vault.systemSalt,
      unlock: vault.unlock,
      logout,
      addWallet,
      createWallet,
      selectWallet,
      clearActiveWallet,
      refreshWallets,
      getDecryptedInfo: vault.getDecryptedInfo,
      getDecryptedInfoWithMasterKey: vault.getDecryptedInfoWithMasterKey,
    }),
    [
      storage.wallets,
      vault.isUnlocked,
      storage.activeAddress,
      storage.activeWallet,
      vault.vaultId,
      vault.masterKey,
      storage.hasSavedLocalAccount,
      vault.systemSalt,
      vault.unlock,
      logout,
      addWallet,
      createWallet,
      selectWallet,
      clearActiveWallet,
      refreshWallets,
      vault.getDecryptedInfo,
      vault.getDecryptedInfoWithMasterKey,
    ],
  )

  const contextValue = useMemo<WalletContextType>(
    () => ({
      active,
      internal: internalObj,
      getLocalAccounts: getLocalAccounts,
      refreshBalance: refreshBalanceCb,
      getAccountsByChain: getAccountsByChain,
    }),
    [
      active,
      internalObj,
      getLocalAccounts,
      refreshBalanceCb,
      getAccountsByChain,
    ],
  )

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}
