import { useWallet } from "@/hooks/account-hooks"

/**
 * A shared hook to determine if the user needs to set up their account
 * based on their wallet configuration.
 */
export function useUserAccountSetup() {
  const wallet = useWallet()
  const walletManager = wallet.internal
  const externalWallets = wallet.external

  const needsAccountSetup =
    !walletManager.isUnlocked && !externalWallets.isArConnected

  const hasAnyAccount = !needsAccountSetup

  return {
    needsAccountSetup,
    hasAnyAccount,
  }
}
