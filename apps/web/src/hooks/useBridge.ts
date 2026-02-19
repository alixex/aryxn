import { useState, useCallback } from "react"
import {
  liFiBridgeService,
  BridgeStatusTracker,
  getChainIdFromName,
  simulateBridgeRoute,
  type BridgeRouteParams,
  type Route,
  type RiskAssessment,
  type CostBreakdown,
  type ChainId,
} from "@aryxn/cross-chain"
import { useBridgeHistory } from "@/lib/store/bridge-history"
import { useWallet } from "@/hooks/account-hooks"
import {
  createEvmProvider,
  createEvmWallet,
  clientToSigner,
} from "@aryxn/wallet-core"
import { getEthereumRpcUrl } from "@/lib/chain/rpc-config"
import { useClient } from "wagmi"
import { toast } from "sonner"

export interface BridgeQuote {
  route: Route
  cost: CostBreakdown
  risk: RiskAssessment
}

const MAX_SINGLE_TX_USD = 100000

export function useBridge() {
  const [loading, setLoading] = useState(false)
  const [quote, setQuote] = useState<BridgeQuote | null>(null)
  const [lastSlippage, setLastSlippage] = useState(0.5)
  const [lastQuoteParams, setLastQuoteParams] =
    useState<BridgeRouteParams | null>(null)
  const transactions = useBridgeHistory((state) => state.transactions)
  const addTransaction = useBridgeHistory((state) => state.addTransaction)
  const updateTransaction = useBridgeHistory((state) => state.updateTransaction)
  const walletManager = useWallet()
  const wagmiClient = useClient()

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
      setLastQuoteParams(null)
      return
    }

    try {
      setLoading(true)
      setLastSlippage(params.slippage ?? 0.5)
      setLastQuoteParams(params)

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
      setLastQuoteParams(null)
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

        // Get wallet signer
        let signer = null
        const isUsingInternalWallet =
          walletManager.internal.isUnlocked &&
          walletManager.internal.activeWallet &&
          walletManager.active.evm?.isExternal === false

        if (isUsingInternalWallet) {
          // Internal wallet: create signer from private key
          const provider = createEvmProvider(getEthereumRpcUrl())
          const privateKey = walletManager.internal.activeWallet as string
          signer = createEvmWallet(privateKey, provider)
          console.log("[useBridge] Using internal wallet signer")
        } else if (wagmiClient) {
          // External wallet: use wagmi client
          try {
            signer = clientToSigner(wagmiClient)
            console.log("[useBridge] Using external wallet signer")
          } catch (error) {
            console.error("[useBridge] Failed to get external signer:", error)
            toast.error("Failed to connect wallet", {
              description: "Please make sure your wallet is connected",
            })
            return
          }
        } else {
          toast.error("No wallet connected", {
            description: "Please connect a wallet first",
          })
          return
        }

        if (!signer) {
          toast.error("Failed to get wallet signer")
          return
        }

        if (quote.cost.priceImpact > lastSlippage) {
          toast.error("Slippage too high", {
            description: `Price impact ${quote.cost.priceImpact.toFixed(2)}% exceeds ${lastSlippage}%`,
          })
          return
        }

        if (quote.risk.amountUSD >= MAX_SINGLE_TX_USD) {
          if (!lastQuoteParams) {
            toast.error("Missing quote parameters for batch execution")
            return
          }

          const batches = liFiBridgeService.createBatchTransactions(
            lastQuoteParams,
            3,
          )

          let confirmedUnsupported = false

          for (let index = 0; index < batches.length; index += 1) {
            const batchParams = batches[index]
            const batchRoute =
              await liFiBridgeService.getOptimalRoute(batchParams)
            const batchCost =
              liFiBridgeService.calculateCostBreakdown(batchRoute)

            if (batchCost.priceImpact > lastSlippage) {
              toast.error("Slippage too high", {
                description: `Batch ${index + 1} price impact ${batchCost.priceImpact.toFixed(2)}% exceeds ${lastSlippage}%`,
              })
              return
            }

            const simulation = await simulateBridgeRoute(batchRoute)
            if (simulation.status === "FAILED") {
              toast.error("Simulation failed", {
                description:
                  simulation.error || "Unable to simulate transaction",
              })
              return
            }

            if (simulation.status === "UNSUPPORTED" && !confirmedUnsupported) {
              const proceed = window.confirm(
                "Simulation not available for this chain. Proceed anyway?",
              )
              if (!proceed) {
                return
              }
              confirmedUnsupported = true
              toast.warning("Proceeding without simulation")
            }

            const txHash = await liFiBridgeService.executeBridgeTransaction(
              batchRoute,
              signer,
            )

            const transactionId = crypto.randomUUID()
            const batchAmount = batchParams.amount

            addTransaction({
              id: transactionId,
              type: "BRIDGE",
              status: "PENDING",
              description: `Batch ${index + 1}/${batches.length}: Bridge ${batchAmount} ${token} from ${fromChainName} to ${toChainName}`,
              timestamp: Date.now(),
              hash: txHash,
              fromChain: fromChainName,
              toChain: toChainName,
              fromChainId,
              toChainId,
              amount: batchAmount,
              token,
            })

            if (index < batches.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 60000))
            }
          }

          toast.success("Batch bridge transactions submitted", {
            description: `Batches: ${batches.length}`,
          })

          setQuote(null)
          setLastQuoteParams(null)
          return
        }

        const simulation = await simulateBridgeRoute(quote.route)

        if (simulation.status === "FAILED") {
          toast.error("Simulation failed", {
            description: simulation.error || "Unable to simulate transaction",
          })
          return
        }

        if (simulation.status === "UNSUPPORTED") {
          const proceed = window.confirm(
            "Simulation not available for this chain. Proceed anyway?",
          )
          if (!proceed) {
            return
          }
          toast.warning("Proceeding without simulation")
        }

        toast.info("Executing bridge transaction...", {
          description: "Please confirm in your wallet",
        })

        // Execute bridge transaction using Li.Fi
        let txHash: string
        try {
          txHash = await liFiBridgeService.executeBridgeTransaction(
            quote.route,
            signer,
          )
          console.log("[useBridge] Transaction hash:", txHash)
        } catch (error) {
          console.error("[useBridge] Transaction execution failed:", error)
          throw error
        }

        // Create transaction record
        const transactionId = crypto.randomUUID()

        addTransaction({
          id: transactionId,
          type: "BRIDGE",
          status: "PENDING",
          description: `Bridge ${amount} ${token} from ${fromChainName} to ${toChainName}`,
          timestamp: Date.now(),
          hash: txHash,
          fromChain: fromChainName,
          toChain: toChainName,
          fromChainId,
          toChainId,
          amount,
          token,
        })

        toast.success("Bridge transaction submitted!", {
          description: `Transaction: ${txHash.slice(0, 10)}...`,
        })

        // Clear quote after execution
        setQuote(null)
      } catch (error) {
        console.error("Bridge execution failed:", error)

        let errorMessage = "Unknown error"
        if (error instanceof Error) {
          errorMessage = error.message
        } else if (typeof error === "object" && error !== null) {
          // Handle wallet rejection errors
          if ("code" in error && error.code === 4001) {
            errorMessage = "Transaction rejected by user"
          } else if ("reason" in error) {
            errorMessage = String(error.reason)
          }
        }

        toast.error("Transaction failed", {
          description: errorMessage,
        })
      } finally {
        setLoading(false)
      }
    },
    [
      quote,
      addTransaction,
      walletManager,
      wagmiClient,
      lastSlippage,
      lastQuoteParams,
    ],
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
