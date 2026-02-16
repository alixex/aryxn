import { useWallet as useInternalWallet } from "@/providers/wallet-provider"

/**
 * The unified wallet hook for Aryxn.
 * Provides access to internal (vault), external (extensions), and synthesized active accounts.
 */
export function useWallet() {
  const context = useInternalWallet()

  return {
    /** Combined active accounts across all chains (prioritizes external) */
    active: context.active,

    /** Internal vault/wallet management */
    internal: context.internal,

    /** External extension wallet management */
    external: context.external,
    // Account helpers (from provider)
    getLocalAccounts: (chain: string) => context.getLocalAccounts(chain),
    getExternalAccounts: (chain: string) => context.getExternalAccounts(chain),
    getAllAccounts: (chain: string) => context.getAllAccounts(chain),
    connectExternal: (chain: string) => context.connectExternal(chain),
    disconnectExternal: (chain: string) => context.disconnectExternal(chain),
    refreshBalance: (chain: string, address: string) =>
      context.refreshBalance(chain, address),
    getAccountsByChain: () => context.getAccountsByChain(),
  }
}

export type UseWalletReturn = ReturnType<typeof useWallet>
