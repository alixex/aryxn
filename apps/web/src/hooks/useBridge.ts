import { useState, useCallback } from "react"
import {
  liFiBridgeService,
  BridgeStatusTracker,
  BridgeRecovery,
  getChainIdFromName,
  simulateBridgeRoute,
  type BridgeRouteParams,
  type Route,
  type RiskAssessment,
  type CostBreakdown,
  type ChainId,
  type RecoveryAction,
  type RetryOptions,
  type SpeedUpOptions,
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

export interface RecoveryOptionsResult {
  recoverable: boolean
  suggestedActions: RecoveryAction[]
  recommendations: {
    recommended: RecoveryAction | null
    reasons: string[]
  }
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

  /**
   * Check recovery options for a transaction
   */
  const checkRecoveryOptions = useCallback(
    async (
      txHash: string,
      fromChain: string,
      toChain: string,
      timestamp: number,
    ): Promise<RecoveryOptionsResult> => {
      const fromChainId = getChainIdFromName(fromChain)
      const toChainId = getChainIdFromName(toChain)

      if (!fromChainId || !toChainId) {
        return {
          recoverable: false,
          suggestedActions: [],
          recommendations: { recommended: null, reasons: [] },
        }
      }

      const timeSinceSubmission = Date.now() - timestamp
      const result = await BridgeRecovery.isRecoverable(
        txHash,
        fromChainId,
        toChainId,
      )

      const recommendations = await BridgeRecovery.getRecommendations(
        txHash,
        fromChainId,
        toChainId,
        timeSinceSubmission,
      )

      return {
        recoverable: result.recoverable,
        suggestedActions: result.suggestedActions,
        recommendations,
      }
    },
    [],
  )

  /**
   * Retry a failed transaction
   */
  const retryTransaction = useCallback(
    async (
      transactionId: string,
      options: RetryOptions = { increaseSlippage: true },
    ) => {
      if (!lastQuoteParams) {
        toast.error("Cannot retry: original parameters not found")
        return
      }

      try {
        setLoading(true)
        toast.info("Retrying transaction with new route...")

        // Get signer
        let signer
        if (
          walletManager.internal.isUnlocked &&
          walletManager.internal.activeWallet
        ) {
          const rpcUrl = getEthereumRpcUrl()
          const provider = createEvmProvider(rpcUrl)
          if (typeof walletManager.internal.activeWallet !== "string") {
            throw new Error("Active internal wallet is not an EVM private key")
          }
          const privateKey = walletManager.internal.activeWallet
          signer = createEvmWallet(privateKey, provider)
        } else if (wagmiClient) {
          signer = await clientToSigner(wagmiClient)
        } else {
          throw new Error("No wallet connected")
        }

        // Retry with recovery tool
        const result = await BridgeRecovery.retry(
          lastQuoteParams,
          signer,
          options,
        )

        if (result.success && result.txHash) {
          // Update old transaction
          updateTransaction(transactionId, {
            status: "FAILED",
            description: "Failed - Retried with new transaction",
          })

          // Add new transaction
          const tx = transactions.find((t) => t.id === transactionId)
          if (tx) {
            addTransaction({
              id: `bridge-${Date.now()}`,
              type: "BRIDGE",
              status: "PENDING",
              description: `Retry: ${tx.description}`,
              timestamp: Date.now(),
              hash: result.txHash,
              fromChain: tx.fromChain,
              toChain: tx.toChain,
              amount: tx.amount,
              token: tx.token,
              fromChainId: tx.fromChainId,
              toChainId: tx.toChainId,
            })
          }

          toast.success("Transaction retried successfully", {
            description: `New transaction: ${result.txHash.slice(0, 10)}...`,
          })
        } else {
          toast.error("Retry failed", {
            description: result.message,
          })
        }
      } catch (error) {
        console.error("[useBridge] Retry failed:", error)
        toast.error("Failed to retry transaction")
      } finally {
        setLoading(false)
      }
    },
    [
      lastQuoteParams,
      walletManager,
      wagmiClient,
      transactions,
      updateTransaction,
      addTransaction,
    ],
  )

  /**
   * Claim a stuck transaction
   */
  const claimTransaction = useCallback(
    async (
      transactionId: string,
      txHash: string,
      fromChain: string,
      toChain: string,
    ) => {
      const fromChainId = getChainIdFromName(fromChain)
      const toChainId = getChainIdFromName(toChain)

      if (!fromChainId || !toChainId) {
        toast.error("Invalid chain names")
        return
      }

      try {
        setLoading(true)
        toast.info("Checking claim status...")

        const result = await BridgeRecovery.claim(
          txHash,
          fromChainId,
          toChainId,
        )

        if (result.success) {
          toast.success("Claim successful", {
            description: result.message,
          })

          updateTransaction(transactionId, {
            status: "COMPLETED",
          })
        } else {
          toast.warning("Claim information", {
            description: result.message,
            duration: 10000,
          })
        }
      } catch (error) {
        console.error("[useBridge] Claim failed:", error)
        toast.error("Failed to check claim status")
      } finally {
        setLoading(false)
      }
    },
    [updateTransaction],
  )

  /**
   * Speed up a pending transaction
   */
  const speedUpTransaction = useCallback(
    async (
      transactionId: string,
      txHash: string,
      options: SpeedUpOptions = { gasMultiplier: 1.2 },
    ) => {
      if (!quote) {
        toast.error("Cannot speed up: quote not found")
        return
      }

      try {
        setLoading(true)
        toast.info("Speeding up transaction...")

        // Get signer
        let signer
        if (
          walletManager.internal.isUnlocked &&
          walletManager.internal.activeWallet
        ) {
          const tx = transactions.find((t) => t.id === transactionId)
          if (!tx?.fromChainId) {
            throw new Error("Chain ID not found")
          }

          const rpcUrl = getEthereumRpcUrl()
          const provider = createEvmProvider(rpcUrl)
          if (typeof walletManager.internal.activeWallet !== "string") {
            throw new Error("Active internal wallet is not an EVM private key")
          }
          const privateKey = walletManager.internal.activeWallet
          signer = createEvmWallet(privateKey, provider)
        } else if (wagmiClient) {
          signer = await clientToSigner(wagmiClient)
        } else {
          throw new Error("No wallet connected")
        }

        const result = await BridgeRecovery.speedUp(
          txHash,
          quote.route,
          signer,
          options,
        )

        if (result.success && result.txHash) {
          toast.success("Transaction sped up", {
            description: result.message,
          })

          updateTransaction(transactionId, {
            hash: result.txHash,
          })
        } else {
          toast.warning("Speed up result", {
            description: result.message,
          })
        }
      } catch (error) {
        console.error("[useBridge] Speed up failed:", error)
        toast.error("Failed to speed up transaction")
      } finally {
        setLoading(false)
      }
    },
    [quote, walletManager, wagmiClient, transactions, updateTransaction],
  )

  return {
    loading,
    quote,
    getQuote,
    executeBridge,
    refreshTransactionStatus,
    getRemainingCooldown,
    canRefresh,
    checkRecoveryOptions,
    retryTransaction,
    claimTransaction,
    speedUpTransaction,
  }
}
