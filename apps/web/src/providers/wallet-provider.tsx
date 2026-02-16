import {
  createContext,
  useContext,
  type ReactNode,
  useCallback,
  useMemo,
} from "react"
import { getBalance, type BalanceResult } from "@/lib/balance"
import { useVault } from "@/hooks/internal-wallet/use-vault"
import { useWalletStorage } from "@/hooks/internal-wallet/use-wallet-storage"
import { useWalletOps } from "@/hooks/internal-wallet/use-wallet-ops"
import {
  useExternalWallets,
  type UseExternalWalletsReturn,
} from "@/hooks/external-wallet/use-external-wallets"
import type {
  WalletRecord,
  WalletKey,
  ActiveAccount,
  DecryptedData,
} from "@aryxn/wallet-core"

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

  // Helpers to retrieve accounts by chain
  getLocalAccounts: (chain: string) => any[]
  getExternalAccounts: (chain: string) => any[]
  getAllAccounts: (chain: string) => any[]

  // Connect/disconnect external wallets by chain
  connectExternal: (chain: string) => Promise<any>
  disconnectExternal: (chain: string) => Promise<any>

  // Refresh balance for an account
  refreshBalance: (
    chain: string,
    address: string,
  ) => Promise<BalanceResult | null>

  // Return mapping of chain -> accounts
  getAccountsByChain: () => Record<string, any[]>

  // Refresh balance helper
  refreshBalance?: (
    chain: string,
    address: string,
  ) => Promise<BalanceResult | null>

  // LEGACY compatibility layer (to avoid breaking whole app at once)
  // These will be deprecated in favor of .internal or .active
  wallets: WalletRecord[]
  isUnlocked: boolean
  activeAddress: string | null
  activeWallet: WalletKey | null
  vaultId: string | null
  masterKey: Uint8Array | null
  unlock: (password: string) => Promise<boolean>
  logout: () => void
  addWallet: (input: WalletKey | string, alias: string) => Promise<void>
  createWallet: (chain: WalletRecord["chain"], alias: string) => Promise<void>
  selectWallet: (address: string) => Promise<void>
  refreshWallets: () => Promise<void>
  getDecryptedInfo: (
    wallet: WalletRecord,
    passwordConfirm: string,
  ) => Promise<DecryptedData>
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
  const external = useExternalWallets()

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

    // External wallets priority
    if (external.isArConnected && external.arAddress) {
      accounts.push({
        address: external.arAddress,
        chain: "arweave",
        isExternal: true,
      })
    }
    if (external.isSolConnected && external.solAddress) {
      accounts.push({
        address: external.solAddress,
        chain: "solana",
        isExternal: true,
      })
    }
    if (external.isSuiConnected && external.suiAddress) {
      accounts.push({
        address: external.suiAddress,
        chain: "sui",
        isExternal: true,
      })
    }
    if (external.isPaymentConnected && external.paymentAddress) {
      accounts.push({
        address: external.paymentAddress,
        chain: "ethereum",
        isExternal: true,
      })
    }

    // Internal wallets fallback
    if (vault.isUnlocked && storage.activeAddress) {
      const activeIntWallet = storage.wallets.find(
        (w) => w.address === storage.activeAddress,
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

  return (
    <WalletContext.Provider
      value={{
        active,
        internal: {
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
        },
        external,

        getLocalAccounts: (chain: string) => {
          return storage.wallets
            .filter((w) => w.chain === chain)
            .map((w) => ({ ...w, id: w.id ?? undefined, isExternal: false }))
        },

        getExternalAccounts: (chain: string) => {
          const out: any[] = []
          if (chain === "ethereum") {
            if (
              external.isPaymentConnected &&
              external.allEVMAddresses &&
              Array.isArray(external.allEVMAddresses)
            ) {
              for (const address of external.allEVMAddresses) {
                if (!address) continue
                out.push({
                  id: `external-evm-${address}`,
                  chain: "ethereum",
                  address,
                  isExternal: true,
                  provider: "EVM",
                })
              }
            }
          }
          if (
            chain === "arweave" &&
            external.isArConnected &&
            external.arAddress
          ) {
            out.push({
              id: `external-arweave-${external.arAddress}`,
              chain: "arweave",
              address: external.arAddress,
              isExternal: true,
              provider: "ArConnect",
            })
          }
          if (
            chain === "solana" &&
            external.isSolConnected &&
            external.solAddress
          ) {
            out.push({
              id: `external-solana-${external.solAddress}`,
              chain: "solana",
              address: external.solAddress,
              isExternal: true,
              provider: "Phantom",
            })
          }
          if (
            chain === "sui" &&
            external.isSuiConnected &&
            external.suiAddress
          ) {
            out.push({
              id: `external-sui-${external.suiAddress}`,
              chain: "sui",
              address: external.suiAddress,
              isExternal: true,
              provider: "Sui Wallet",
            })
          }
          return out
        },

        getAllAccounts: (chain: string) => {
          const local = storage.wallets
            .filter((w) => w.chain === chain)
            .map((w) => ({ ...w, id: w.id ?? undefined, isExternal: false }))
          const externalList = (() => {
            const out: any[] = []
            if (chain === "ethereum") {
              if (
                external.isPaymentConnected &&
                external.allEVMAddresses &&
                Array.isArray(external.allEVMAddresses)
              ) {
                for (const address of external.allEVMAddresses) {
                  if (!address) continue
                  out.push({
                    id: `external-evm-${address}`,
                    chain: "ethereum",
                    address,
                    isExternal: true,
                    provider: "EVM",
                  })
                }
              }
            }
            if (
              chain === "arweave" &&
              external.isArConnected &&
              external.arAddress
            ) {
              out.push({
                id: `external-arweave-${external.arAddress}`,
                chain: "arweave",
                address: external.arAddress,
                isExternal: true,
                provider: "ArConnect",
              })
            }
            if (
              chain === "solana" &&
              external.isSolConnected &&
              external.solAddress
            ) {
              out.push({
                id: `external-solana-${external.solAddress}`,
                chain: "solana",
                address: external.solAddress,
                isExternal: true,
                provider: "Phantom",
              })
            }
            if (
              chain === "sui" &&
              external.isSuiConnected &&
              external.suiAddress
            ) {
              out.push({
                id: `external-sui-${external.suiAddress}`,
                chain: "sui",
                address: external.suiAddress,
                isExternal: true,
                provider: "Sui Wallet",
              })
            }
            return out
          })()
          return [...local, ...externalList]
        },
        // Connect to external wallets by chain
        connectExternal: async (chain: string) => {
          try {
            if (chain === "arweave" && external.connectArweave)
              return await external.connectArweave()
            if (chain === "solana" && external.connectSolana)
              return await external.connectSolana()
            if (chain === "sui" && external.connectSui)
              return await external.connectSui()
            // EVM connection handled by wagmi/rainbowkit connectors in UI
            return undefined
          } catch (e) {
            console.error("connectExternal failed", e)
            throw e
          }
        },

        disconnectExternal: async (chain: string) => {
          try {
            if (chain === "arweave" && external.disconnectArweave)
              return await external.disconnectArweave()
            if (chain === "solana" && external.disconnectSolana)
              return await external.disconnectSolana()
            if (chain === "sui" && external.disconnectSui)
              return await external.disconnectSui()
            // EVM disconnect handled by wagmi
            return undefined
          } catch (e) {
            console.error("disconnectExternal failed", e)
            throw e
          }
        },

        refreshBalance: async (
          chain: string,
          address: string,
        ): Promise<BalanceResult | null> => {
          try {
            const bal = await getBalance(chain as any, address)
            return bal
          } catch (e) {
            console.error("refreshBalance failed", e)
            return null
          }
        },

        // Return mapping of chain -> accounts
        getAccountsByChain: () => {
          const chains = ["ethereum", "bitcoin", "solana", "sui", "arweave"]
          const out: Record<string, any[]> = {}
          for (const c of chains) {
            out[c] = (
              storage.wallets
                .filter((w) => w.chain === c)
                .map((w) => ({
                  ...w,
                  id: w.id ?? undefined,
                  isExternal: false,
                })) as any[]
            ).concat(
              (() => {
                const ext: any[] = []
                if (
                  c === "ethereum" &&
                  external.isPaymentConnected &&
                  external.allEVMAddresses &&
                  Array.isArray(external.allEVMAddresses)
                ) {
                  for (const a of external.allEVMAddresses)
                    if (a)
                      ext.push({
                        id: `external-evm-${a}`,
                        chain: "ethereum",
                        address: a,
                        isExternal: true,
                      })
                }
                if (
                  c === "arweave" &&
                  external.isArConnected &&
                  external.arAddress
                )
                  ext.push({
                    id: `external-arweave-${external.arAddress}`,
                    chain: "arweave",
                    address: external.arAddress,
                    isExternal: true,
                  })
                if (
                  c === "solana" &&
                  external.isSolConnected &&
                  external.solAddress
                )
                  ext.push({
                    id: `external-solana-${external.solAddress}`,
                    chain: "solana",
                    address: external.solAddress,
                    isExternal: true,
                  })
                if (
                  c === "sui" &&
                  external.isSuiConnected &&
                  external.suiAddress
                )
                  ext.push({
                    id: `external-sui-${external.suiAddress}`,
                    chain: "sui",
                    address: external.suiAddress,
                    isExternal: true,
                  })
                return ext
              })(),
            )
          }
          return out
        },

        // Legacy compatibility
        wallets: storage.wallets,
        isUnlocked: vault.isUnlocked,
        activeAddress: storage.activeAddress,
        activeWallet: storage.activeWallet,
        vaultId: vault.vaultId,
        masterKey: vault.masterKey,
        unlock: vault.unlock,
        logout,
        addWallet,
        createWallet,
        selectWallet,
        refreshWallets,
        getDecryptedInfo: vault.getDecryptedInfo,
      }}
    >
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
