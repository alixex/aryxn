import { useWallet } from "@/hooks/account-hooks"

/**
 * A shared hook to determine if the user needs to set up their account
 * based on their wallet configuration.
 */
export function useUserAccountSetup() {
  const wallet = useWallet()
  const walletManager = wallet.internal

  // User needs setup if they haven't unlocked their internal vault
  // and have no wallets at all.
  // Simplified: if they are locked, they need setup (unlock).
  const needsAccountSetup = !walletManager.isUnlocked

  const hasAnyAccount = walletManager.wallets.length > 0

  return {
    needsAccountSetup,
    hasAnyAccount,
  }
}
