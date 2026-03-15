import { useState, useRef, useEffect } from "react"
import { type BalanceResult } from "@/lib/chain"
import { useWallet } from "./use-wallet"

/**
 * Manage account list and balance information.
 *
 * @example
 * const {
 *   balances,
 *   loadingBalances,
 *   refreshBalance,
 * } = useAccounts()
 */
export function useAccounts() {
  const wallet = useWallet()
  const [balances, setBalances] = useState<
    Record<string, BalanceResult | null>
  >({})
  const [loadingBalances, setLoadingBalances] = useState<
    Record<string, boolean>
  >({})
  const [showBalances, setShowBalances] = useState<Record<string, boolean>>({})

  const fetchedBalancesRef = useRef<Set<string>>(new Set())

  // Generate a stable signature for accounts to prevent infinite loops
  const accountsByChain = wallet.getAccountsByChain()
  const allAccounts = Object.values(accountsByChain).flat()
  const accountsSignature = JSON.stringify(
    allAccounts.map((a) => `${a.chain}-${a.address}`),
  )

  useEffect(() => {
    if (allAccounts.length === 0) return

    const fetchAll = async () => {
      for (const account of allAccounts) {
        const key = `${account.chain}-${account.address}`
        if (fetchedBalancesRef.current.has(key)) continue
        fetchedBalancesRef.current.add(key)

        setLoadingBalances((prev) => ({ ...prev, [key]: true }))
        try {
          const bal = await wallet.refreshBalance(
            account.chain,
            account.address,
          )
          if (bal) bal.timestamp = Date.now()
          setBalances((prev) => ({ ...prev, [key]: bal }))
        } catch (error) {
          console.error(
            `Failed to fetch balance for ${account.address}:`,
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

    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountsSignature])

  const refreshBalance = async (chain: string, address: string) => {
    const key = `${chain}-${address}`
    fetchedBalancesRef.current.delete(key)

    setLoadingBalances((prev) => ({ ...prev, [key]: true }))
    try {
      const bal = await wallet.refreshBalance(chain, address)
      if (bal) bal.timestamp = Date.now()
      setBalances((prev) => ({ ...prev, [key]: bal }))
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
    /** Cached account balances. */
    balances,
    /** Loading state for balances. */
    loadingBalances,
    /** Visibility state for balances. */
    showBalances,
    /** Refresh one account balance. */
    refreshBalance,
    /** Toggle balance visibility. */
    toggleShowBalance,
  }
}

// No default export as per naming conventions
