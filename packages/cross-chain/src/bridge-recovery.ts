import {
  getStatus,
  type Route,
  type ChainId,
  type StatusResponse,
} from "@lifi/sdk"
import { EvmChainIds } from "@aryxn/chain-constants"
import type { Signer } from "ethers"
import {
  liFiBridgeService,
  type BridgeRouteParams,
} from "./lifi-bridge-service"

/**
 * Recovery action types
 */
export type RecoveryAction = "RETRY" | "CLAIM" | "SPEED_UP"

/**
 * Recovery result
 */
export interface RecoveryResult {
  success: boolean
  action: RecoveryAction
  txHash?: string
  error?: string
  message: string
}

/**
 * Recovery options for retry
 */
export interface RetryOptions {
  increaseSlippage?: boolean // Increase slippage tolerance
  slippageIncrease?: number // Additional slippage % (default: 0.5%)
  useHigherPriority?: boolean // Switch to faster route
}

/**
 * Speed up options for pending transactions
 */
export interface SpeedUpOptions {
  gasMultiplier?: number // Multiply current gas price (default: 1.2 = 20% increase)
  maxGasPrice?: bigint // Maximum gas price willing to pay
}

/**
 * Bridge Recovery Tools
 * Provides utilities to recover from failed or stuck bridge transactions
 */
export class BridgeRecovery {
  /**
   * Check if a transaction is recoverable
   */
  static async isRecoverable(
    txHash: string,
    fromChainId: ChainId,
    toChainId: ChainId,
  ): Promise<{
    recoverable: boolean
    suggestedActions: RecoveryAction[]
    status: StatusResponse
  }> {
    try {
      const status = await getStatus({
        txHash,
        fromChain: fromChainId,
        toChain: toChainId,
      })

      const suggestedActions: RecoveryAction[] = []

      // Failed transactions can be retried
      if (status.status === "FAILED") {
        suggestedActions.push("RETRY")
      }

      // Pending transactions might be claimable or speed-uppable
      if (status.status === "PENDING") {
        // Pending transactions can potentially be claimed or sped up
        // Time-based recommendations are handled in getRecommendations()
        suggestedActions.push("CLAIM")

        // EVM transactions can be sped up
        const isEVMChain = EvmChainIds.includes(
          Number(fromChainId) as (typeof EvmChainIds)[number],
        )
        if (isEVMChain) {
          suggestedActions.push("SPEED_UP")
        }
      }

      return {
        recoverable: suggestedActions.length > 0,
        suggestedActions,
        status,
      }
    } catch (error) {
      console.error("[BridgeRecovery] Failed to check recoverability:", error)
      return {
        recoverable: false,
        suggestedActions: [],
        status: {} as StatusResponse,
      }
    }
  }

  /**
   * Retry a failed bridge transaction
   * Fetches a new quote and executes with potentially better conditions
   */
  static async retry(
    params: BridgeRouteParams,
    signer: Signer,
    options: RetryOptions = {},
  ): Promise<RecoveryResult> {
    try {
      console.log("[BridgeRecovery] Retrying bridge transaction...")

      // Adjust parameters based on options
      const retryParams = { ...params }

      // Increase slippage if requested
      if (options.increaseSlippage) {
        const increase = options.slippageIncrease || 0.5
        retryParams.slippage = (retryParams.slippage || 0.5) + increase
        console.log(
          `[BridgeRecovery] Increased slippage to ${retryParams.slippage}%`,
        )
      }

      // Switch to faster route if requested
      if (options.useHigherPriority) {
        retryParams.priority = "fastest"
        console.log("[BridgeRecovery] Switching to fastest route")
      }

      // Get new quote
      const route = await liFiBridgeService.getOptimalRoute(retryParams)

      // Execute with new route
      const txHash = await liFiBridgeService.executeBridgeTransaction(
        route,
        signer,
      )

      return {
        success: true,
        action: "RETRY",
        txHash,
        message: "Transaction retried successfully with new route",
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      console.error("[BridgeRecovery] Retry failed:", error)

      return {
        success: false,
        action: "RETRY",
        error: errorMessage,
        message: `Failed to retry: ${errorMessage}`,
      }
    }
  }

  /**
   * Manually claim a stuck cross-chain transfer
   * Note: This depends on Li.Fi providing claim functionality
   * Currently returns guidance for manual claiming
   */
  static async claim(
    txHash: string,
    fromChainId: ChainId,
    toChainId: ChainId,
  ): Promise<RecoveryResult> {
    try {
      console.log("[BridgeRecovery] Checking claim status...")

      const status = await getStatus({
        txHash,
        fromChain: fromChainId,
        toChain: toChainId,
      })

      // Check if there's a receiving transaction
      const receivingInfo = (status as { receiving?: { txHash?: string } })
        .receiving
      if (receivingInfo && receivingInfo.txHash) {
        return {
          success: false,
          action: "CLAIM",
          message:
            "Transaction already completed on destination chain. No claim needed.",
        }
      }

      // Check if funds are stuck on bridge contract
      if (status.status === "PENDING" && status.sending?.txHash) {
        // In a full implementation, this would interact with the bridge contract
        // For now, provide manual claim guidance
        const tool = status.tool || "unknown bridge"

        return {
          success: false,
          action: "CLAIM",
          message: `Manual claim required. Visit ${tool} bridge interface and use transaction hash: ${txHash}. Or contact Li.Fi support for assistance.`,
        }
      }

      return {
        success: false,
        action: "CLAIM",
        message: "Transaction not in a claimable state",
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      console.error("[BridgeRecovery] Claim check failed:", error)

      return {
        success: false,
        action: "CLAIM",
        error: errorMessage,
        message: `Failed to check claim status: ${errorMessage}`,
      }
    }
  }

  /**
   * Speed up a pending EVM transaction by replacing it with higher gas
   * Note: This only works for transactions that haven't been mined yet
   */
  static async speedUp(
    txHash: string,
    route: Route,
    signer: Signer,
    options: SpeedUpOptions = {},
  ): Promise<RecoveryResult> {
    try {
      console.log("[BridgeRecovery] Attempting to speed up transaction...")

      // Get current transaction
      const provider = signer.provider
      if (!provider) {
        throw new Error("Signer has no provider")
      }

      const tx = await provider.getTransaction(txHash)
      if (!tx) {
        throw new Error("Transaction not found")
      }

      // Check if already mined
      if (tx.blockNumber) {
        return {
          success: false,
          action: "SPEED_UP",
          message:
            "Transaction already mined. Speed up not possible or needed.",
        }
      }

      // Calculate new gas price
      const gasMultiplier = options.gasMultiplier || 1.2
      let newGasPrice: bigint

      if (tx.gasPrice) {
        // Legacy transaction
        newGasPrice =
          (tx.gasPrice * BigInt(Math.floor(gasMultiplier * 100))) / 100n
      } else if (tx.maxFeePerGas) {
        // EIP-1559 transaction
        newGasPrice =
          (tx.maxFeePerGas * BigInt(Math.floor(gasMultiplier * 100))) / 100n
      } else {
        throw new Error("Cannot determine gas price from original transaction")
      }

      // Check max gas price limit
      if (options.maxGasPrice && newGasPrice > options.maxGasPrice) {
        return {
          success: false,
          action: "SPEED_UP",
          message: `New gas price (${newGasPrice}) exceeds maximum allowed (${options.maxGasPrice})`,
        }
      }

      // Get transaction request from route
      const firstStep = route.steps[0]
      if (!firstStep || !firstStep.transactionRequest) {
        throw new Error("No transaction request in route")
      }

      const txRequest = firstStep.transactionRequest

      // Send replacement transaction with same nonce but higher gas
      const replacementTx = await signer.sendTransaction({
        to: txRequest.to as string,
        data: txRequest.data as string,
        value: txRequest.value ? BigInt(txRequest.value) : undefined,
        nonce: tx.nonce, // Same nonce to replace
        gasLimit: tx.gasLimit,
        gasPrice: tx.gasPrice ? newGasPrice : undefined,
        maxFeePerGas: tx.maxFeePerGas ? newGasPrice : undefined,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas
          ? (tx.maxPriorityFeePerGas *
              BigInt(Math.floor(gasMultiplier * 100))) /
            100n
          : undefined,
      })

      console.log(
        "[BridgeRecovery] Speed up transaction sent:",
        replacementTx.hash,
      )

      return {
        success: true,
        action: "SPEED_UP",
        txHash: replacementTx.hash,
        message: `Transaction sped up with ${Math.floor((gasMultiplier - 1) * 100)}% higher gas. New hash: ${replacementTx.hash}`,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      console.error("[BridgeRecovery] Speed up failed:", error)

      return {
        success: false,
        action: "SPEED_UP",
        error: errorMessage,
        message: `Failed to speed up transaction: ${errorMessage}`,
      }
    }
  }

  /**
   * Get recovery recommendations for a transaction
   */
  static async getRecommendations(
    txHash: string,
    fromChainId: ChainId,
    toChainId: ChainId,
    timeSinceSubmission: number, // milliseconds
  ): Promise<{
    recommended: RecoveryAction | null
    reasons: string[]
  }> {
    const { recoverable, suggestedActions, status } = await this.isRecoverable(
      txHash,
      fromChainId,
      toChainId,
    )

    if (!recoverable) {
      return { recommended: null, reasons: [] }
    }

    const reasons: string[] = []

    // Failed -> Retry
    if (status.status === "FAILED") {
      reasons.push("Transaction failed, retry with new route may succeed")
      return { recommended: "RETRY", reasons }
    }

    // Pending transactions - use time-based recommendations
    if (status.status === "PENDING") {
      // Very recent (< 30 minutes) - no action needed yet
      if (timeSinceSubmission < 30 * 60 * 1000) {
        return { recommended: null, reasons: ["Transaction too recent"] }
      }

      // Very long pending (> 2 hours) -> Claim
      if (timeSinceSubmission > 2 * 60 * 60 * 1000) {
        reasons.push("Transaction pending for over 2 hours")
        reasons.push("Funds may be stuck on bridge contract")
        return { recommended: "CLAIM", reasons }
      }

      // Moderate pending (30 min - 2 hours) -> Speed Up (if EVM)
      if (timeSinceSubmission > 30 * 60 * 1000) {
        reasons.push(
          `Transaction pending for ${Math.floor(timeSinceSubmission / 60000)} minutes`,
        )
        if (suggestedActions.includes("SPEED_UP")) {
          reasons.push(
            "Gas price may be too low for current network conditions",
          )
          return { recommended: "SPEED_UP", reasons }
        } else {
          // Non-EVM chains can't speed up, just wait or claim
          return { recommended: "CLAIM", reasons }
        }
      }
    }

    // Default to first suggested action
    return {
      recommended: suggestedActions[0] || null,
      reasons,
    }
  }
}
