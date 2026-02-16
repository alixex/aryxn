import { useEffect, useRef, useState, useCallback } from "react"
import { getBalance, type BalanceResult } from "@/lib/balance"

type ExternalWallets = any
type WalletManager = any

export function useAccounts(
  walletManager: WalletManager,
  externalWallets: ExternalWallets,
) {
  const [balances, setBalances] = useState<
    Record<string, BalanceResult | null>
  >({})
  const [loadingBalances, setLoadingBalances] = useState<
    Record<string, boolean>
  >({})
  const [showBalances, setShowBalances] = useState<Record<string, boolean>>({})

  const fetchedBalancesRef = useRef<Set<string>>(new Set())

  // Fetch balances for local wallets
  useEffect(() => {
    if (!walletManager.isUnlocked || walletManager.wallets.length === 0) return

    const fetchBalances = async () => {
      for (const wallet of walletManager.wallets) {
        const key = `${wallet.chain}-${wallet.address}`
        if (fetchedBalancesRef.current.has(key)) continue
        fetchedBalancesRef.current.add(key)

        setLoadingBalances((prev) => ({ ...prev, [key]: true }))
        try {
          const balance = await getBalance(wallet.chain, wallet.address)
          setBalances((prev) => ({ ...prev, [key]: balance }))
        } catch (error) {
          console.error(`Failed to fetch balance for ${wallet.address}:`, error)
          setBalances((prev) => ({
            ...prev,
            [key]: {
              balance: "0",
              formatted: "0",
              symbol: wallet.chain.toUpperCase(),
              error: "Failed to fetch",
            },
          }))
        } finally {
          setLoadingBalances((prev) => ({ ...prev, [key]: false }))
        }
      }
    }

    fetchBalances()
  }, [walletManager.isUnlocked, walletManager.wallets.length])

  // External accounts helper
  const getExternalAccounts = useCallback(() => {
    const externalAccounts: Array<any> = []

    if (
      externalWallets.isPaymentConnected &&
      externalWallets.allEVMAddresses &&
      Array.isArray(externalWallets.allEVMAddresses) &&
      externalWallets.allEVMAddresses.length > 0
    ) {
      externalWallets.allEVMAddresses.forEach((address: string) => {
        if (address && typeof address === "string") {
          const isActive =
            address.toLowerCase() ===
            externalWallets.paymentAddress?.toLowerCase()
          externalAccounts.push({
            id: `external-evm-${address}`,
            chain: "ethereum",
            address: address,
            alias: isActive ? "" : "",
            isExternal: true,
            provider: "EVM",
          })
        }
      })
    }

    if (externalWallets.isArConnected && externalWallets.arAddress) {
      externalAccounts.push({
        id: `external-arweave-${externalWallets.arAddress}`,
        chain: "arweave",
        address: externalWallets.arAddress,
        alias: "",
        isExternal: true,
        provider: "ArConnect",
      })
    }

    if (externalWallets.isSolConnected && externalWallets.solAddress) {
      externalAccounts.push({
        id: `external-solana-${externalWallets.solAddress}`,
        chain: "solana",
        address: externalWallets.solAddress,
        alias: "",
        isExternal: true,
        provider: "Phantom",
      })
    }

    if (externalWallets.isSuiConnected && externalWallets.suiAddress) {
      externalAccounts.push({
        id: `external-sui-${externalWallets.suiAddress}`,
        chain: "sui",
        address: externalWallets.suiAddress,
        alias: "",
        isExternal: true,
        provider: "Sui Wallet",
      })
    }

    return externalAccounts
  }, [externalWallets])

  // Fetch balances for external accounts
  useEffect(() => {
    const externalAccounts = getExternalAccounts()
    if (externalAccounts.length === 0) return

    const fetchExternalBalances = async () => {
      for (const account of externalAccounts) {
        const key = `external-${account.chain}-${account.address}`
        if (fetchedBalancesRef.current.has(key)) continue
        fetchedBalancesRef.current.add(key)

        setLoadingBalances((prev) => ({ ...prev, [key]: true }))
        try {
          const balance = await getBalance(account.chain, account.address)
          setBalances((prev) => ({ ...prev, [key]: balance }))
        } catch (error) {
          console.error(
            `Failed to fetch balance for external ${account.address}:`,
            error,
          )
          setBalances((prev) => ({
            ...prev,
            [key]: {
              balance: "0",
              formatted: "0",
              symbol: account.chain.toUpperCase(),
              error: "Failed to fetch",
            },
          }))
        } finally {
          setLoadingBalances((prev) => ({ ...prev, [key]: false }))
        }
      }
    }

    fetchExternalBalances()
  }, [
    externalWallets.isPaymentConnected,
    externalWallets.paymentAddress,
    externalWallets.isArConnected,
    externalWallets.arAddress,
    externalWallets.isSolConnected,
    externalWallets.solAddress,
    externalWallets.isSuiConnected,
    externalWallets.suiAddress,
    getExternalAccounts,
  ])

  const refreshBalance = async (
    chain: string,
    address: string,
    isExternal = false,
  ) => {
    const key = isExternal
      ? `external-${chain}-${address}`
      : `${chain}-${address}`
    fetchedBalancesRef.current.delete(key)

    setLoadingBalances((prev) => ({ ...prev, [key]: true }))
    try {
      const balance = await getBalance(chain, address)
      setBalances((prev) => ({ ...prev, [key]: balance }))
      fetchedBalancesRef.current.add(key)
    } catch (error) {
      console.error(`Failed to fetch balance for ${address}:`, error)
      setBalances((prev) => ({
        ...prev,
        [key]: {
          balance: "0",
          formatted: "0",
          symbol: chain.toUpperCase(),
          error: "Failed to fetch",
        },
      }))
    } finally {
      setLoadingBalances((prev) => ({ ...prev, [key]: false }))
    }
  }

  const toggleShowBalance = (key: string, show: boolean) => {
    setShowBalances((prev) => ({ ...prev, [key]: show }))
  }

  return {
    balances,
    loadingBalances,
    showBalances,
    refreshBalance,
    toggleShowBalance,
    getExternalAccounts,
  }
}

export default useAccounts
