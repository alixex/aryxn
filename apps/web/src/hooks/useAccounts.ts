import { useEffect, useRef, useState, useCallback } from "react"
import { type BalanceResult } from "@/lib/balance"
import { useWallet } from "@/hooks/use-wallet"

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

  // Fetch balances for all accounts (local + external) using provider helpers
  useEffect(() => {
    const accountsByChain = wallet.getAccountsByChain()
    const allAccounts = Object.values(accountsByChain).flat()
    if (allAccounts.length === 0) return

    const fetchAll = async () => {
      for (const account of allAccounts) {
        const key = `${account.isExternal ? "external-" : ""}${account.chain}-${account.address}`
        if (fetchedBalancesRef.current.has(key)) continue
        fetchedBalancesRef.current.add(key)

        setLoadingBalances((prev) => ({ ...prev, [key]: true }))
        try {
          const bal = await wallet.refreshBalance(
            account.chain,
            account.address,
          )
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
  }, [wallet.getAccountsByChain])

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
      const bal = await wallet.refreshBalance(chain, address)
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

  const getExternalAccounts = useCallback(
    (chain?: string) => {
      if (chain) return wallet.getExternalAccounts(chain)
      const chains = ["ethereum", "bitcoin", "solana", "sui", "arweave"]
      let out: any[] = []
      for (const c of chains) out = out.concat(wallet.getExternalAccounts(c))
      return out
    },
    [wallet],
  )

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
