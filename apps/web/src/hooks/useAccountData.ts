import { useCallback } from "react"
import type { UseWalletReturn } from "@/hooks/use-wallet"

type AccountOut = {
  id?: string | number
  chain: string
  address: string
  alias: string
  isExternal: boolean
  encryptedKey?: string
  vaultId?: string
  createdAt?: number
}

export default function useAccountData(wallet: UseWalletReturn, t: any) {
  const getLocalAccounts = useCallback(
    (chain: string) => {
      return wallet.internal.wallets
        .filter((w) => w.chain === chain)
        .map((w) => ({
          ...w,
          id: w.id ?? undefined,
          isExternal: false,
        })) as AccountOut[]
    },
    [wallet],
  )

  const getExternalAccounts = useCallback(
    (chain: string) => {
      const external: AccountOut[] = []

      const ext = wallet.external

      if (chain === "ethereum") {
        if (
          ext.isPaymentConnected &&
          ext.allEVMAddresses &&
          Array.isArray(ext.allEVMAddresses)
        ) {
          ext.allEVMAddresses.forEach((address: string) => {
            if (!address) return
            const isActive =
              address.toLowerCase() === ext.paymentAddress?.toLowerCase()
            external.push({
              id: `external-evm-${address}`,
              chain: "ethereum",
              address,
              alias: isActive
                ? t("identities.evmWalletCurrent")
                : t("identities.evmWalletAddress", {
                    address: `${address.slice(0, 6)}...${address.slice(-4)}`,
                  }),
              isExternal: true,
              provider: "EVM",
            } as any)
          })
        }
      }

      if (chain === "arweave" && ext.isArConnected && ext.arAddress) {
        external.push({
          id: `external-arweave-${ext.arAddress}`,
          chain: "arweave",
          address: ext.arAddress,
          alias: t("identities.arconnectWallet"),
          isExternal: true,
        })
      }

      if (chain === "solana" && ext.isSolConnected && ext.solAddress) {
        external.push({
          id: `external-solana-${ext.solAddress}`,
          chain: "solana",
          address: ext.solAddress,
          alias: t("identities.phantomWallet"),
          isExternal: true,
        })
      }

      if (chain === "sui" && ext.isSuiConnected && ext.suiAddress) {
        external.push({
          id: `external-sui-${ext.suiAddress}`,
          chain: "sui",
          address: ext.suiAddress,
          alias: t("identities.suiWallet"),
          isExternal: true,
        })
      }

      return external
    },
    [wallet, t],
  )

  const getAllAccounts = useCallback(
    (chain: string) => {
      const local = getLocalAccounts(chain)
      const external = getExternalAccounts(chain)
      const mappedExternal = external.map((acc) => ({
        ...acc,
        alias:
          acc.chain === "ethereum"
            ? t("identities.evmWallet")
            : acc.chain === "arweave"
              ? t("identities.arconnectWallet")
              : acc.chain === "solana"
                ? t("identities.phantomWallet")
                : acc.chain === "sui"
                  ? t("identities.suiWallet")
                  : t("identities.externalAccount"),
      }))
      return [...local, ...mappedExternal]
    },
    [getLocalAccounts, getExternalAccounts, t],
  )

  return { getLocalAccounts, getExternalAccounts, getAllAccounts }
}
