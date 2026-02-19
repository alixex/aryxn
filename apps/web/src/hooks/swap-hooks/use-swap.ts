/**
 * Main swap hook - orchestrates the complete swap workflow
 * Integrates balance checking, approval, quote fetching, and swap execution
 */

import { useState, useCallback, useEffect } from "react"
import {
  useConnection,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi"
import type { Address } from "@aryxn/wallet-core"
import { MULTI_HOP_SWAPPER_ABI } from "@/lib/contracts/multi-hop-swapper-abi"
import { MULTI_HOP_SWAPPER_ADDRESS } from "@/lib/contracts/addresses"
import { useSwapQuote } from "./use-swap-quote"
import { useTokenBalance } from "./use-token-balance"
import { useTokenApproval } from "./use-token-approval"
import { parseTokenAmount } from "@/lib/contracts/token-config"

export interface SwapRoute {
  path: string[]
  fee: string
  expectedOutput: string
}

/**
 * Swap state constants
 * Using object literal instead of enum for erasableSyntaxOnly compatibility
 * NOTE: This is duplicated from use-swap-internal.ts - exported there instead
 */
const SwapState = {
  IDLE: "idle",
  FETCHING_QUOTE: "fetching_quote",
  NEEDS_APPROVAL: "needs_approval",
  APPROVING: "approving",
  READY: "ready",
  SWAPPING: "swapping",
  CONFIRMING: "confirming",
  SUCCESS: "success",
  ERROR: "error",
} as const

type SwapState = (typeof SwapState)[keyof typeof SwapState]

interface UseMultiHopSwapParams {
  inputToken: Address
  outputToken: Address
  inputAmount: string
  decimalsIn: number
  decimalsOut: number
  slippage: number
}

export function useMultiHopSwap({
  inputToken,
  outputToken,
  inputAmount,
  decimalsIn,
  decimalsOut,
  slippage,
}: UseMultiHopSwapParams) {
  const { address, isConnected } = useConnection()
  const publicClient = usePublicClient()
  const [swapState, setSwapState] = useState<SwapState>(SwapState.IDLE)
  const [error, setError] = useState<string>("")
  const [gasPrice, setGasPrice] = useState<string>("")
  const [gasEstimate, setGasEstimate] = useState<bigint>(0n)

  // Parse input amount
  const amountIn =
    inputAmount && !isNaN(parseFloat(inputAmount))
      ? parseTokenAmount(inputAmount, decimalsIn)
      : 0n

  // Get token balance
  const {
    balance: inputBalance,
    formattedBalance,
    refetch: refetchBalance,
    lastUpdated,
  } = useTokenBalance({
    tokenAddress: inputToken,
    decimals: decimalsIn,
    enabled: isConnected,
  })

  // Get swap quote
  const {
    quote,
    isLoading: quoteFetching,
    error: quoteError,
    refetch: refetchQuote,
  } = useSwapQuote({
    tokenIn: inputToken,
    tokenOut: outputToken,
    amountIn,
    decimalsOut,
    slippage,
    enabled: isConnected && amountIn > 0n,
  })

  // Check and manage approval
  const { needsApproval, isApproving, isWaitingForApproval, approve } =
    useTokenApproval({
      tokenAddress: inputToken,
      spenderAddress: MULTI_HOP_SWAPPER_ADDRESS,
      requiredAmount: amountIn,
      enabled: isConnected && amountIn > 0n,
    })

  // Write contract for swap
  const {
    writeContract,
    data: swapHash,
    isPending: isSwapping,
    error: swapError,
  } = useWriteContract()

  // Wait for swap transaction
  const {
    isLoading: isConfirming,
    isSuccess: swapSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash: swapHash,
  })

  // Fetch gas price with fallback
  useEffect(() => {
    const fetchGasPrice = async () => {
      if (!publicClient) return

      try {
        const price = await publicClient.getGasPrice()
        setGasPrice((Number(price) / 1e9).toFixed(2))
      } catch (err: any) {
        // Silently handle CORS and network errors
        if (
          err?.message?.includes("CORS") ||
          err?.message?.includes("Failed to fetch")
        ) {
          setGasPrice("50") // Fallback gas price in gwei
        } else {
          console.error("Failed to fetch gas price:", err)
        }
      }
    }

    fetchGasPrice()
    const interval = setInterval(fetchGasPrice, 5000)
    return () => clearInterval(interval)
  }, [publicClient])

  // Estimate gas for swap
  useEffect(() => {
    const estimateGas = async () => {
      if (!quote || !address || amountIn === 0n) {
        setGasEstimate(0n)
        return
      }

      try {
        const gas = await publicClient?.estimateContractGas({
          address: MULTI_HOP_SWAPPER_ADDRESS,
          abi: MULTI_HOP_SWAPPER_ABI,
          functionName: "swap",
          args: [
            inputToken,
            outputToken,
            amountIn,
            quote.minimumOutput,
            quote.route,
          ],
          account: address,
        })
        setGasEstimate(gas ?? 0n)
      } catch (err) {
        console.error("Failed to estimate gas:", err)
        setGasEstimate(200000n) // Fallback estimate
      }
    }

    estimateGas()
  }, [quote, address, amountIn, inputToken, outputToken, publicClient])

  // Update swap state
  useEffect(() => {
    if (!isConnected) {
      setSwapState(SwapState.IDLE)
      return
    }

    if (quoteFetching) {
      setSwapState(SwapState.FETCHING_QUOTE)
      return
    }

    if (isApproving || isWaitingForApproval) {
      setSwapState(SwapState.APPROVING)
      return
    }

    if (needsApproval && amountIn > 0n) {
      setSwapState(SwapState.NEEDS_APPROVAL)
      return
    }

    if (isSwapping) {
      setSwapState(SwapState.SWAPPING)
      return
    }

    if (isConfirming) {
      setSwapState(SwapState.CONFIRMING)
      return
    }

    if (swapSuccess) {
      setSwapState(SwapState.SUCCESS)
      refetchBalance()
      return
    }

    if (quoteError || swapError || confirmError) {
      setSwapState(SwapState.ERROR)
      setError(
        (quoteError?.message || swapError?.message || confirmError?.message) ??
          "Unknown error",
      )
      return
    }

    if (quote && amountIn > 0n && !needsApproval) {
      setSwapState(SwapState.READY)
      return
    }

    setSwapState(SwapState.IDLE)
  }, [
    isConnected,
    quoteFetching,
    isApproving,
    isWaitingForApproval,
    needsApproval,
    isSwapping,
    isConfirming,
    swapSuccess,
    quoteError,
    swapError,
    confirmError,
    quote,
    amountIn,
    refetchBalance,
  ])

  // Execute swap
  const executeSwap = useCallback(() => {
    if (!quote || !address || amountIn === 0n) {
      setError("Invalid swap parameters")
      return
    }

    // Check balance
    if (inputBalance < amountIn) {
      setError("Insufficient balance")
      return
    }

    setError("")

    writeContract({
      address: MULTI_HOP_SWAPPER_ADDRESS,
      abi: MULTI_HOP_SWAPPER_ABI,
      functionName: "swap",
      args: [
        inputToken,
        outputToken,
        amountIn,
        quote.minimumOutput,
        quote.route,
      ],
    })
  }, [
    quote,
    address,
    amountIn,
    inputBalance,
    writeContract,
    inputToken,
    outputToken,
  ])

  // Legacy format for route (for compatibility)
  const route: SwapRoute | null = quote
    ? {
        path: quote.route.map((addr) => addr.slice(0, 8) + "..."),
        fee: "0.04",
        expectedOutput: quote.formattedOutput,
      }
    : null

  return {
    // State
    swapState,

    // Quote data
    outputAmount: quote?.formattedOutput ?? "",
    route,
    quote,

    // Balance
    inputBalance,
    formattedBalance,
    hasInsufficientBalance: inputBalance < amountIn && amountIn > 0n,

    // Approval
    needsApproval,
    approve,

    // Gas
    gasEstimate: gasEstimate.toString(),
    gasPrice,

    // Loading states
    loading:
      quoteFetching ||
      isApproving ||
      isWaitingForApproval ||
      isSwapping ||
      isConfirming,

    // Errors
    error,

    // Actions
    executeSwap,
    refetchQuote,
    refetchBalance,

    // Transaction
    swapHash,
    swapSuccess,
    lastUpdated,
  }
}
