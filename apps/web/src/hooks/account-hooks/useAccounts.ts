import { useEffect, useRef, useState, useCallback } from "react"
import { type BalanceResult } from "@/lib/chain"
import { useWallet } from "./use-wallet"

/**
 * Manage account list and balance information.
 * 管理账户列表和余额信息
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
    /** 账户余额缓存 */
    balances,
    /** 余额加载状态 */
    loadingBalances,
    /** 余额显示状态 */
    showBalances,
    /** 刷新单个账户余额 */
    refreshBalance,
    /** 切换余额显示状态 */
    toggleShowBalance,
    /** 获取外部账户 */
    getExternalAccounts,
  }
}

// No default export as per naming conventions
