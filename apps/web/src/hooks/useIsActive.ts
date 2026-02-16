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

export default function useIsActive(walletManager: any, externalWallets: any) {
  return (account: Account) => {
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
}
