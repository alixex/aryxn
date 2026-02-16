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

    // Flattened common actions for convenience
    isUnlocked: context.internal.isUnlocked,
    unlock: context.internal.unlock,
    logout: context.internal.logout,
    refresh: context.internal.refreshWallets,
  }
}

export type UseWalletReturn = ReturnType<typeof useWallet>
