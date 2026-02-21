/**
 * Hook for managing DEX swap transaction history
 * Stores transactions in localStorage and tracks on-chain events
 */

import { useState, useEffect, useCallback } from "react"
import { useConnection, usePublicClient } from "wagmi"
import type { Address, Hash } from "@aryxn/wallet-core"
import { MULTI_HOP_SWAPPER_ABI } from "@/lib/contracts/multi-hop-swapper-abi"
import { MULTI_HOP_SWAPPER_ADDRESS } from "@/lib/contracts/addresses"
import { getTokenByAddress } from "@/lib/contracts/token-config"

export interface SwapTransaction {
  hash: Hash
  timestamp: number
  user: Address
  tokenIn: Address
  tokenOut: Address
  tokenInSymbol: string
  tokenOutSymbol: string
  amountIn: string
  amountOut: string
  fee: string
  gasUsed: string
  status: "pending" | "confirmed" | "failed"
}

const STORAGE_KEY = "aryxn_dex_transactions"

/**
 * Get stored transactions from localStorage
 */
function getStoredTransactions(address?: Address): SwapTransaction[] {
  if (!address) return []

  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${address}`)
    if (!stored) return []
    return JSON.parse(stored) as SwapTransaction[]
  } catch (error) {
    console.error("Failed to load transactions from storage:", error)
    return []
  }
}

/**
 * Save transactions to localStorage
 */
function saveTransactions(address: Address, transactions: SwapTransaction[]) {
  try {
    localStorage.setItem(
      `${STORAGE_KEY}_${address}`,
      JSON.stringify(transactions),
    )
  } catch (error) {
    console.error("Failed to save transactions to storage:", error)
  }
}

/**
 * Hook for managing swap transaction history
 */
export function useTransactionHistory() {
  const { address } = useConnection()
  const publicClient = usePublicClient()
  const [transactions, setTransactions] = useState<SwapTransaction[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load transactions from localStorage on mount
  useEffect(() => {
    if (address) {
      const stored = getStoredTransactions(address)
      setTransactions(stored)
    } else {
      setTransactions([])
    }
  }, [address])

  // Add new transaction
  const addTransaction = useCallback(
    (tx: Omit<SwapTransaction, "timestamp" | "status">) => {
      if (!address) return

      const newTx: SwapTransaction = {
        ...tx,
        timestamp: Date.now(),
        status: "pending",
      }

      const updated = [newTx, ...transactions]
      setTransactions(updated)
      saveTransactions(address, updated)
    },
    [address, transactions],
  )

  // Update transaction status
  const updateTransactionStatus = useCallback(
    (hash: Hash, status: SwapTransaction["status"]) => {
      if (!address) return

      const updated = transactions.map((tx) =>
        tx.hash === hash ? { ...tx, status } : tx,
      )

      setTransactions(updated)
      saveTransactions(address, updated)
    },
    [address, transactions],
  )

  // Fetch swap events from blockchain
  const fetchSwapEvents = useCallback(async () => {
    if (!address || !publicClient) return

    setIsLoading(true)

    try {
      // Get SwapExecuted events from the contract
      const latestBlock = await publicClient.getBlockNumber()
      const fromBlock = latestBlock - 10000n // Last ~10000 blocks

      const logs = await publicClient.getLogs({
        address: MULTI_HOP_SWAPPER_ADDRESS,
        event: MULTI_HOP_SWAPPER_ABI.find(
          (item) => item.type === "event" && item.name === "SwapExecuted",
        )!,
        fromBlock,
        toBlock: "latest",
        args: {
          user: address,
        },
      })

      // Get block timestamps for all transactions
      const blockNumbers = new Set(logs.map((log) => log.blockNumber))
      const blockTimestamps = new Map<bigint, number>()

      // Fetch block timestamps in parallel
      await Promise.all(
        Array.from(blockNumbers).map(async (blockNumber) => {
          try {
            const block = await publicClient.getBlock({ blockNumber })
            blockTimestamps.set(blockNumber, Number(block.timestamp) * 1000)
          } catch (error) {
            console.error(`Failed to fetch block ${blockNumber}:`, error)
            blockTimestamps.set(blockNumber, Date.now())
          }
        }),
      )

      const swapTxs: SwapTransaction[] = logs.map((log) => {
        const { user, tokenIn, tokenOut, amountIn, amountOut, fee, gasUsed } =
          log.args as any

        const tokenInInfo = getTokenByAddress(tokenIn, publicClient.chain.id)
        const tokenOutInfo = getTokenByAddress(tokenOut, publicClient.chain.id)

        return {
          hash: log.transactionHash!,
          timestamp: blockTimestamps.get(log.blockNumber) ?? Date.now(),
          user,
          tokenIn,
          tokenOut,
          tokenInSymbol: tokenInInfo?.symbol ?? "UNKNOWN",
          tokenOutSymbol: tokenOutInfo?.symbol ?? "UNKNOWN",
          amountIn: amountIn.toString(),
          amountOut: amountOut.toString(),
          fee: fee.toString(),
          gasUsed: gasUsed.toString(),
          status: "confirmed" as const,
        }
      })

      // Merge with existing transactions (avoid duplicates)
      const existingHashes = new Set(transactions.map((tx) => tx.hash))
      const newTxs = swapTxs.filter((tx) => !existingHashes.has(tx.hash))

      if (newTxs.length > 0) {
        const updated = [...newTxs, ...transactions]
        setTransactions(updated)
        saveTransactions(address, updated)
      }
    } catch (error) {
      console.error("Failed to fetch swap events:", error)
    } finally {
      setIsLoading(false)
    }
  }, [address, publicClient, transactions])

  // Clear all transactions
  const clearTransactions = useCallback(() => {
    if (!address) return

    setTransactions([])
    localStorage.removeItem(`${STORAGE_KEY}_${address}`)
  }, [address])

  return {
    transactions,
    isLoading,
    addTransaction,
    updateTransactionStatus,
    fetchSwapEvents,
    clearTransactions,
  }
}
