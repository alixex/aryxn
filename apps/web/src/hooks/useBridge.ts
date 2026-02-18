import { useState, useCallback } from "react"
import {
  liFiBridgeService,
  BridgeStatusTracker,
  getChainIdFromName,
  type BridgeRouteParams,
  type Route,
  type RiskAssessment,
  type CostBreakdown,
  type ChainId,
} from "@aryxn/cross-chain"
import { useBridgeHistory } from "@/lib/store/bridge-history"
import { toast } from "sonner"

export interface BridgeQuote {
  route: Route
  cost: CostBreakdown
  risk: RiskAssessment
}

export function useBridge() {
  const [loading, setLoading] = useState(false)
  const [quote, setQuote] = useState<BridgeQuote | null>(null)
  const transactions = useBridgeHistory((state) => state.transactions)
  const addTransaction = useBridgeHistory((state) => state.addTransaction)
  const updateTransaction = useBridgeHistory((state) => state.updateTransaction)

  /**
   * Manually refresh transaction status (with rate limiting)
   */
  const refreshTransactionStatus = useCallback(
    async (txHash: string, fromChain: string, toChain: string) => {
      const fromChainId = getChainIdFromName(fromChain)
      const toChainId = getChainIdFromName(toChain)

      if (!fromChainId || !toChainId) {
        toast.error("Invalid chain names")
        return
      }

      try {
        // Check rate limit before making request
        if (!BridgeStatusTracker.canRefresh(txHash)) {
          const cooldown = BridgeStatusTracker.getRemainingCooldown(txHash)
          toast.warning("Rate limit", {
            description: `Please wait ${cooldown}s before refreshing`,
          })
          return
        }

        // Fetch status
        const trackingInfo = await BridgeStatusTracker.checkStatus(
          txHash,
          fromChainId as ChainId,
          toChainId as ChainId,
        )

        // Find the transaction in history
        const transaction = transactions.find((tx) => tx.hash === txHash)
        if (!transaction) {
          toast.error("Transaction not found")
          return
        }

        const updates: Record<string, any> = {
          lastUpdate: trackingInfo.lastUpdate,
        }

        switch (trackingInfo.status) {
          case "PENDING":
          case "IN_PROGRESS":
            updates.status = "PENDING"
            updates.description = `Bridging ${transaction.amount} ${transaction.token}... (${trackingInfo.substatus || "Processing"})`
            toast.info("Transaction pending", {
              description: trackingInfo.substatus || "Still processing...",
            })
            break

          case "COMPLETED":
            updates.status = "COMPLETED"
            updates.description = `Successfully bridged ${transaction.amount} ${transaction.token} to ${toChain}`
            if (trackingInfo.destTxHash) {
              updates.hash = trackingInfo.destTxHash
            }

            toast.success("Bridge completed!", {
              description: `${transaction.amount} ${transaction.token} arrived on ${toChain}`,
            })

            // Clear rate limit for completed transactions
            BridgeStatusTracker.clearRateLimit(txHash)
            break

          case "FAILED":
            updates.status = "FAILED"
            updates.description = `Bridge failed: ${trackingInfo.substatus || "Unknown error"}`

            toast.error("Bridge failed", {
              description: trackingInfo.substatus || "Transaction failed",
            })

            // Clear rate limit for failed transactions
            BridgeStatusTracker.clearRateLimit(txHash)
            break
        }

        updateTransaction(transaction.id, updates)
      } catch (error) {
        console.error("[useBridge] Failed to refresh status:", error)
        toast.error("Failed to fetch status", {
          description: error instanceof Error ? error.message : "Unknown error",
        })
      }
    },
    [transactions, updateTransaction],
  )

  /**
   * Get remaining cooldown for a transaction
   */
  const getRemainingCooldown = useCallback((txHash: string) => {
    return BridgeStatusTracker.getRemainingCooldown(txHash)
  }, [])

  /**
   * Check if refresh is allowed for a transaction
   */
  const canRefresh = useCallback((txHash: string) => {
    return BridgeStatusTracker.canRefresh(txHash)
  }, [])

  /**
   * Get bridge quote for given parameters
   */
  const getQuote = useCallback(async (params: BridgeRouteParams) => {
    if (!params.amount || params.amount === "0") {
      setQuote(null)
      return
    }

    try {
      setLoading(true)

      // Get optimal route
      const route = await liFiBridgeService.getOptimalRoute(params)

      // Calculate cost & risk based on route
      const cost = liFiBridgeService.calculateCostBreakdown(route)
      const risk = await liFiBridgeService.assessRisk(route)

      setQuote({ route, cost, risk })
    } catch (error) {
      console.error("Failed to get quote:", error)
      toast.error("Failed to get quote", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
      setQuote(null)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Execute bridge transaction
   */
  const executeBridge = useCallback(
    async (
      amount: string,
      token: string,
      fromChainName: string,
      toChainName: string,
    ) => {
      if (!quote) {
        toast.error("No quote available")
        return
      }

      try {
        setLoading(true)

        // Get chain IDs
        const fromChainId = getChainIdFromName(fromChainName)
        const toChainId = getChainIdFromName(toChainName)

        if (!fromChainId || !toChainId) {
          toast.error("Invalid chain names")
          return
        }

        // TODO: Actual execution with wallet signer
        // For now, create a pending transaction
        const txId = "0x" + Math.random().toString(16).slice(2)
        const transactionId = crypto.randomUUID()

        addTransaction({
          id: transactionId,
          type: "BRIDGE",
          status: "PENDING",
          description: `Bridge ${amount} ${token} from ${fromChainName} to ${toChainName}`,
          timestamp: Date.now(),
          hash: txId,
          fromChain: fromChainName,
          toChain: toChainName,
          fromChainId,
          toChainId,
          amount,
          token,
        })

        toast.success("Bridge transaction initiated", {
          description: "Click refresh button to check status",
        })

        // Clear quote after execution
        setQuote(null)
      } catch (error) {
        console.error("Bridge execution failed:", error)
        toast.error("Transaction failed", {
          description: error instanceof Error ? error.message : "Unknown error",
        })
      } finally {
        setLoading(false)
      }
    },
    [quote, addTransaction],
  )

  return {
    loading,
    quote,
    getQuote,
    executeBridge,
    refreshTransactionStatus,
    getRemainingCooldown,
    canRefresh,
  }
}
