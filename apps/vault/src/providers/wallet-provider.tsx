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
import {
  useExternalAggregation,
  type UseExternalWalletsReturn,
} from "@/hooks/account-hooks/external-wallet/use-external-aggregation"
import { AccountChains, Chains } from "@aryxn/chain-constants"
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

// Helper: build external accounts for a chain from external hook
function buildExternalForChainFromExternal(
  external: UseExternalWalletsReturn,
  chain: string,
): AccountInfo[] {
  const chainHandlers: Record<string, () => AccountInfo[]> = {
    [Chains.ETHEREUM]: () => {
      if (
        !external.isPaymentConnected ||
        !external.allEVMAddresses ||
        !Array.isArray(external.allEVMAddresses)
      ) {
        return []
      }
      return external.allEVMAddresses
        .filter((address) => !!address)
        .map((address) => ({
          id: `external-evm-${address}`,
          chain: "ethereum" as const,
          address,
          isExternal: true as const,
          provider: "EVM",
        }))
    },
    [Chains.ARWEAVE]: () => {
      if (!external.isArConnected || !external.arAddress) return []
      return [
        {
          id: `external-arweave-${external.arAddress}`,
          chain: "arweave" as const,
          address: external.arAddress,
          isExternal: true as const,
          provider: "ArConnect",
        },
      ]
    },
    [Chains.SOLANA]: () => {
      if (!external.isSolConnected || !external.solAddress) return []
      return [
        {
          id: `external-solana-${external.solAddress}`,
          chain: "solana" as const,
          address: external.solAddress,
          isExternal: true as const,
          provider: "Phantom",
        },
      ]
    },
    [Chains.SUI]: () => {
      if (!external.isSuiConnected || !external.suiAddress) return []
      return [
        {
          id: `external-sui-${external.suiAddress}`,
          chain: "sui" as const,
          address: external.suiAddress,
          isExternal: true as const,
          provider: "Sui Wallet",
        },
      ]
    },
  }

  const handler = chainHandlers[chain]
  return handler ? handler() : []
}

// Helper: build all accounts for a chain combining storage + external
function buildAllForChain(
  storage: ReturnType<typeof useWalletStorage>,
  external: UseExternalWalletsReturn,
  chain: string,
): AccountInfo[] {
  return [
    ...buildLocalForChain(storage, chain),
    ...buildExternalForChainFromExternal(external, chain),
  ]
}

interface WalletContextType {
  // Unified Active Account (aggregated)
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
    addWallet: (input: WalletKey | string, alias: string) => Promise<void>
    createWallet: (chain: WalletRecord["chain"], alias: string) => Promise<void>
    selectWallet: (address: string) => Promise<void>
    clearActiveWallet: () => void
    refreshWallets: () => Promise<void>
    getDecryptedInfo: (
      wallet: WalletRecord,
      passwordConfirm: string,
    ) => Promise<DecryptedData>
  }

  // External Wallets (Extensions)
  external: UseExternalWalletsReturn

  // Grouped external actions helpers
  externalActions: {
    connect: (chain: string) => Promise<any>
    disconnect: (chain: string) => Promise<any>
    getAddresses: (chain: string) => string[]
  }

  // Helpers to retrieve accounts by chain
  getLocalAccounts: (chain: string) => AccountInfo[]
  getExternalAccounts: (chain: string) => AccountInfo[]
  getAllAccounts: (chain: string) => AccountInfo[]

  // Connect/disconnect external wallets by chain
  connectExternal: (chain: string) => Promise<any>
  disconnectExternal: (chain: string) => Promise<any>

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

  // 4. External Wallets Integration
  const external = useExternalAggregation()

  // --- Actions ---

  const logout = useCallback(async () => {
    await storage.clearPersistence()
    vault.clearVault()
  }, [storage, vault])

  const addWallet = useCallback(
    async (input: WalletKey | string, alias: string) => {
      if (!vault.masterKey || !vault.vaultId) return
      await ops.addWalletLogic(input, alias, vault.masterKey, vault.vaultId)
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

  // --- Unified Active Account Synthesis ---

  const active = useMemo(() => {
    const accounts: ActiveAccount[] = []
    // External wallets priority (configurable list)
    const externalPrioritySpecs: Array<{
      chain: ActiveAccount["chain"]
      isConnected: () => boolean
      getAddress: () => string | null | undefined
    }> = [
      {
        chain: "arweave",
        isConnected: () => external.isArConnected,
        getAddress: () => external.arAddress,
      },
      {
        chain: "solana",
        isConnected: () => external.isSolConnected,
        getAddress: () => external.solAddress,
      },
      {
        chain: "sui",
        isConnected: () => external.isSuiConnected,
        getAddress: () => external.suiAddress,
      },
      {
        chain: "ethereum",
        isConnected: () => external.isPaymentConnected,
        getAddress: () => external.paymentAddress,
      },
    ]

    for (const spec of externalPrioritySpecs) {
      try {
        if (spec.isConnected()) {
          const addr = spec.getAddress()
          if (addr) {
            accounts.push({
              address: addr,
              chain: spec.chain,
              isExternal: true,
            })
          }
        }
      } catch (e) {
        // Defensive: continue if external provider shape changes
        console.debug("external priority spec failed", e)
      }
    }

    // Internal wallets fallback
    if (vault.isUnlocked && storage.activeAddress) {
      const activeIntWallet = storage.wallets.find(
        (w: WalletRecord) => w.address === storage.activeAddress,
      )
      if (activeIntWallet) {
        const chainMapping: Record<string, ActiveAccount["chain"]> = {
          arweave: "arweave",
          solana: "solana",
          sui: "sui",
          ethereum: "ethereum",
          bitcoin: "ethereum",
        }
        const mappedChain = chainMapping[activeIntWallet.chain]
        if (mappedChain) {
          const alreadyHasExternal = accounts.some(
            (acc) => acc.chain === mappedChain && acc.isExternal,
          )
          if (!alreadyHasExternal) {
            accounts.push({
              address: activeIntWallet.address,
              chain: mappedChain,
              isExternal: false,
            })
          }
        }
      }
    }

    return {
      accounts,
      arweave: accounts.find((acc) => acc.chain === "arweave"),
      solana: accounts.find((acc) => acc.chain === "solana"),
      sui: accounts.find((acc) => acc.chain === "sui"),
      evm: accounts.find((acc) => acc.chain === "ethereum"),
      hasAny: accounts.length > 0,
    }
  }, [external, vault.isUnlocked, storage.activeAddress, storage.wallets])

  // --- Context Value ---

  // Grouped external actions (centralized, reused by UI and compatibility wrappers)
  const externalActions = useMemo<WalletContextType["externalActions"]>(
    () => ({
      connect: async (chain: string) => {
        const connectHandlers: Record<string, () => Promise<any>> = {
          [Chains.ARWEAVE]: async () =>
            external.connectArweave
              ? await external.connectArweave()
              : undefined,
          [Chains.SOLANA]: async () =>
            external.connectSolana ? await external.connectSolana() : undefined,
          [Chains.SUI]: async () =>
            external.connectSui ? await external.connectSui() : undefined,
        }
        const handler = connectHandlers[chain]
        if (handler) return await handler()
        // EVM connection handled by wagmi/rainbowkit connectors in UI
        return undefined
      },
      disconnect: async (chain: string) => {
        const disconnectHandlers: Record<string, () => Promise<any>> = {
          [Chains.ARWEAVE]: async () =>
            external.disconnectArweave
              ? await external.disconnectArweave()
              : undefined,
          [Chains.SOLANA]: async () =>
            external.disconnectSolana
              ? await external.disconnectSolana()
              : undefined,
          [Chains.SUI]: async () =>
            external.disconnectSui ? await external.disconnectSui() : undefined,
        }
        const handler = disconnectHandlers[chain]
        if (handler) return await handler()
        // EVM disconnect handled by wagmi
        return undefined
      },
      getAddresses: (chain: string) =>
        buildExternalForChainFromExternal(external, chain).map(
          (a) => a.address,
        ),
    }),
    [external],
  )

  const getLocalAccounts = useCallback(
    (chain: string): AccountInfo[] => buildLocalForChain(storage, chain),
    [storage],
  )

  const getExternalAccounts = useCallback(
    (chain: string): AccountInfo[] =>
      buildExternalForChainFromExternal(external, chain),
    [external],
  )

  const getAllAccounts = useCallback(
    (chain: string): AccountInfo[] =>
      buildAllForChain(storage, external, chain),
    [storage, external],
  )

  const getAccountsByChain = useCallback((): Record<string, AccountInfo[]> => {
    const out: Record<string, AccountInfo[]> = {}
    for (const c of AccountChains)
      out[c] = getLocalAccounts(c).concat(getExternalAccounts(c))
    return out
  }, [getLocalAccounts, getExternalAccounts])

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
    ],
  )

  const contextValue = useMemo<WalletContextType>(
    () => ({
      active,
      internal: internalObj,
      external,

      getLocalAccounts: getLocalAccounts,

      getExternalAccounts: getExternalAccounts,

      getAllAccounts: getAllAccounts,
      // External actions grouped (shared implementation)
      externalActions: externalActions,
      // Connect to external wallets by chain (compatibility wrapper)
      connectExternal: externalActions.connect,
      disconnectExternal: externalActions.disconnect,

      refreshBalance: refreshBalanceCb,

      // Return mapping of chain -> accounts
      getAccountsByChain: getAccountsByChain,
    }),
    [
      active,
      internalObj,
      external,
      getLocalAccounts,
      getExternalAccounts,
      getAllAccounts,
      externalActions,
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
