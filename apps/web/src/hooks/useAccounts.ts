import { useEffect, useRef, useState, useCallback } from "react"
import { getBalance, type BalanceResult } from "@/lib/balance"
import { useWallet } from "@/hooks/use-wallet"

export function useAccounts() {
  const wallet = useWallet()
  const walletManager = wallet.internal
  const externalWallets = wallet.external
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
  const getExternalAccounts = useCallback(
    (chain?: string) => {
      // prefer provider helpers when available
      if (chain) return wallet.getExternalAccounts(chain)
      const chains = ["ethereum", "bitcoin", "solana", "sui", "arweave"]
      let out: any[] = []
      for (const c of chains) out = out.concat(wallet.getExternalAccounts(c))
      return out
    },
    [wallet],
  )

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
