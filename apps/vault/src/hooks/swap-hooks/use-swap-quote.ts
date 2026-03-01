/**
 * Hook for getting swap quotes from MultiHopSwapper contract
 */

import { useState, useEffect, useCallback } from "react"
import { usePublicClient, useChainId } from "wagmi"
import type { Address } from "@aryxn/wallet-core"
import { MULTI_HOP_SWAPPER_ABI } from "@/lib/contracts/multi-hop-swapper-abi"
import { getSwapperAddress } from "@/lib/contracts/addresses"
import { formatTokenAmount } from "@/lib/contracts/token-config"

export interface SwapQuote {
  route: Address[]
  expectedOutput: bigint
  formattedOutput: string
  priceImpact: number
  fee: bigint
  minimumOutput: bigint
  formattedMinimumOutput: string
}

interface UseSwapQuoteParams {
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  decimalsOut: number
  slippage: number // Percentage (e.g., 1.0 for 1%)
  enabled?: boolean
}

interface SwapQuoteResult {
  quote: SwapQuote | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Get swap quote from MultiHopSwapper contract
 */
export function useSwapQuote({
  tokenIn,
  tokenOut,
  amountIn,
  decimalsOut,
  slippage,
  enabled = true,
}: UseSwapQuoteParams): SwapQuoteResult {
  const publicClient = usePublicClient()
  const chainId = useChainId()
  const swapperAddress = getSwapperAddress(chainId)

  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchQuote = useCallback(async () => {
    if (
      !enabled ||
      !publicClient ||
      amountIn === 0n ||
      tokenIn === tokenOut ||
      !swapperAddress
    ) {
      setQuote(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Call getOptimalRoute from the contract
      const result = await publicClient.readContract({
        address: swapperAddress,
        abi: MULTI_HOP_SWAPPER_ABI,
        functionName: "getOptimalRoute",
        args: [tokenIn, tokenOut, amountIn],
      })

      const [routeResult, estimatedOut] = result
      // Spread from readonly (wagmi inferred) to mutable for QuoteData.route
      const route: Address[] = [...routeResult]

      // Calculate fee (matches the contract's default feeRate = 4 bps = 0.04%).
      // If the contract's feeRate is updated via setFeeRate(), update BASE_FEE here too.
      const FEE_DENOMINATOR = 10000n
      const BASE_FEE = 4n
      const fee = (amountIn * BASE_FEE) / FEE_DENOMINATOR

      // Calculate minimum output with slippage
      const slippageBps = BigInt(Math.floor(slippage * 100))
      const minimumOutput = (estimatedOut * (10000n - slippageBps)) / 10000n

      const priceImpact = 0

      const quoteData: SwapQuote = {
        route,
        expectedOutput: estimatedOut,
        formattedOutput: formatTokenAmount(estimatedOut, decimalsOut),
        priceImpact,
        fee,
        minimumOutput,
        formattedMinimumOutput: formatTokenAmount(minimumOutput, decimalsOut),
      }

      setQuote(quoteData)
    } catch (err) {
      console.error("Failed to fetch swap quote:", err)
      setError(err as Error)
      setQuote(null)
    } finally {
      setIsLoading(false)
    }
  }, [
    enabled,
    publicClient,
    tokenIn,
    tokenOut,
    amountIn,
    decimalsOut,
    slippage,
    swapperAddress,
  ])

  // Debounced fetch with 500ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuote()
    }, 500)

    return () => clearTimeout(timer)
  }, [fetchQuote])

  return {
    quote,
    isLoading,
    error,
    refetch: fetchQuote,
  }
}
