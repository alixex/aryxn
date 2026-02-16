/**
 * Hook for querying ERC20 token balances
 */

import { useEffect, useState } from "react"
import { useConnection, usePublicClient, useReadContract } from "wagmi"
import type { Address } from "@aryxn/wallet-core"
import { ERC20_ABI } from "@/lib/contracts/multi-hop-swapper-abi"
import { formatTokenAmount } from "@/lib/contracts/token-config"

interface UseTokenBalanceParams {
  tokenAddress: Address
  decimals: number
  enabled?: boolean
}

interface TokenBalanceResult {
  balance: bigint
  formattedBalance: string
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Query token balance for the connected account
 */
export function useTokenBalance({
  tokenAddress,
  decimals,
  enabled = true,
}: UseTokenBalanceParams): TokenBalanceResult {
  const { address: accountAddress } = useConnection()

  const {
    data: balance,
    isLoading,
    error,
    refetch: refetchContract,
  } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: accountAddress ? [accountAddress] : undefined,
    query: {
      enabled: enabled && !!accountAddress,
      refetchInterval: 10000, // Auto-refetch every 10 seconds
    },
  })

  const refetch = () => {
    refetchContract()
  }

  const balanceValue = balance ?? 0n
  const formattedBalance = formatTokenAmount(balanceValue, decimals)

  return {
    balance: balanceValue,
    formattedBalance,
    isLoading,
    error: error as Error | null,
    refetch,
  }
}

/**
 * Query balances for multiple tokens
 */
export function useMultipleTokenBalances(
  tokens: Array<{ address: Address; decimals: number }>,
) {
  const { address: accountAddress } = useConnection()
  const publicClient = usePublicClient()
  const [balances, setBalances] = useState<Map<Address, bigint>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchBalances = async () => {
    if (!accountAddress || !publicClient || tokens.length === 0) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const balancePromises = tokens.map(async (token) => {
        const balance = await publicClient.readContract({
          address: token.address,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [accountAddress],
        })
        return { address: token.address, balance: balance as bigint }
      })

      const results = await Promise.all(balancePromises)
      const balanceMap = new Map<Address, bigint>()
      results.forEach((result) => {
        balanceMap.set(result.address, result.balance)
      })

      setBalances(balanceMap)
    } catch (err) {
      setError(err as Error)
      console.error("Failed to fetch token balances:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBalances()
    // Auto-refetch every 10 seconds
    const interval = setInterval(fetchBalances, 10000)
    return () => clearInterval(interval)
  }, [accountAddress, publicClient, JSON.stringify(tokens)])

  return {
    balances,
    isLoading,
    error,
    refetch: fetchBalances,
  }
}
