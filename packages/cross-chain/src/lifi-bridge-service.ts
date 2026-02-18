import {
  getRoutes,
  getStatus,
  getTokens,
  getChains,
  type Route,
  type RoutesRequest,
  type Token,
  type ChainId,
  type StatusResponse,
  type ExtendedChain,
} from "@lifi/sdk"
import type { Signer } from "ethers"

// Re-export types for consumers
export type {
  Route,
  ChainId,
  Token,
  StatusResponse,
  ExtendedChain,
} from "@lifi/sdk"

/**
 * Bridge execution priority
 */
export type BridgePriority = "fastest" | "balanced" | "cheapest"

/**
 * Bridge route parameters
 */
export interface BridgeRouteParams {
  fromChain: ChainId
  toChain: ChainId
  fromToken: string // Token address
  toToken: string // Token address
  amount: string // Amount in wei/smallest unit
  fromAddress: string
  toAddress: string
  priority?: BridgePriority
  slippage?: number // Percentage (default: 0.5%)
}

/**
 * Cost breakdown for a bridge route
 */
export interface CostBreakdown {
  gasCost: number // In USD
  protocolFees: number // In USD
  priceImpact: number // Percentage
  total: number // In USD
  estimatedTime: number // In seconds
}

/**
 * Risk assessment levels
 */
export enum RiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

/**
 * Risk assessment result
 */
export interface RiskAssessment {
  level: RiskLevel
  amountUSD: number
  warning?: string
  suggestBatch?: boolean
}

/**
 * Li.Fi Bridge Service
 * Integrates with Li.Fi SDK for cross-chain asset transfers
 */
export class LiFiBridgeService {
  private static readonly RISK_THRESHOLDS = {
    LOW: 1000, // < $1K: No warning
    MEDIUM: 10000, // $1K-10K: Suggest batch
    HIGH: 100000, // > $100K: Require batch or CEX
  }

  /**
   * Get optimal bridge route based on priority
   */
  async getOptimalRoute(params: BridgeRouteParams): Promise<Route> {
    const {
      fromChain,
      toChain,
      fromToken,
      toToken,
      amount,
      fromAddress,
      toAddress,
      priority = "balanced",
      slippage = 0.5,
    } = params

    const routesRequest: RoutesRequest = {
      fromChainId: fromChain,
      toChainId: toChain,
      fromTokenAddress: fromToken,
      toTokenAddress: toToken,
      fromAmount: amount,
      fromAddress,
      toAddress,
      options: {
        slippage: slippage / 100,
        order: this.getPriorityOrder(priority),
        // Limit number of routes for faster response
        maxPriceImpact: 0.05, // 5% max price impact
      },
    }

    const result = await getRoutes(routesRequest)

    if (!result.routes || result.routes.length === 0) {
      throw new Error("No routes found for this bridge transaction")
    }

    // Return the first route (already sorted by priority)
    return result.routes[0]
  }

  /**
   * Get multiple route options for comparison
   */
  async getRouteOptions(params: BridgeRouteParams): Promise<Route[]> {
    const routesRequest: RoutesRequest = {
      fromChainId: params.fromChain,
      toChainId: params.toChain,
      fromTokenAddress: params.fromToken,
      toTokenAddress: params.toToken,
      fromAmount: params.amount,
      fromAddress: params.fromAddress,
      toAddress: params.toAddress,
      options: {
        slippage: (params.slippage || 0.5) / 100,
      },
    }

    const result = await getRoutes(routesRequest)
    return result.routes || []
  }

  /**
   * Calculate cost breakdown for a route
   */
  calculateCostBreakdown(route: Route): CostBreakdown {
    let gasCost = 0
    let protocolFees = 0
    let priceImpact = 0
    let estimatedTime = 0

    for (const step of route.steps) {
      // Sum up gas costs
      if (step.estimate.gasCosts) {
        gasCost += step.estimate.gasCosts.reduce(
          (sum, cost) => sum + parseFloat(cost.amountUSD || "0"),
          0,
        )
      }

      // Sum up protocol fees
      if (step.estimate.feeCosts) {
        protocolFees += step.estimate.feeCosts.reduce(
          (sum, fee) => sum + parseFloat(fee.amountUSD || "0"),
          0,
        )
      }

      // Sum up execution time
      estimatedTime += step.estimate.executionDuration || 0
    }

    // Calculate price impact from route
    const fromAmountUSD = parseFloat(route.fromAmountUSD || "0")
    const toAmountUSD = parseFloat(route.toAmountUSD || "0")
    if (fromAmountUSD > 0) {
      priceImpact =
        ((fromAmountUSD - toAmountUSD - gasCost - protocolFees) /
          fromAmountUSD) *
        100
    }

    return {
      gasCost,
      protocolFees,
      priceImpact: Math.max(0, priceImpact),
      total: gasCost + protocolFees,
      estimatedTime,
    }
  }

  /**
   * Assess risk level based on transaction amount
   */
  async assessRisk(route: Route): Promise<RiskAssessment> {
    const amountUSD = parseFloat(route.fromAmountUSD || "0")

    if (amountUSD < LiFiBridgeService.RISK_THRESHOLDS.LOW) {
      return {
        level: RiskLevel.LOW,
        amountUSD,
      }
    }

    if (amountUSD < LiFiBridgeService.RISK_THRESHOLDS.MEDIUM) {
      return {
        level: RiskLevel.MEDIUM,
        amountUSD,
        warning:
          "Consider splitting into smaller transactions for added security.",
        suggestBatch: true,
      }
    }

    return {
      level: RiskLevel.HIGH,
      amountUSD,
      warning:
        "Large amount detected. Strongly recommend splitting or using a centralized exchange.",
      suggestBatch: true,
    }
  }

  /**
   * Check transaction status
   */
  async getTransactionStatus(
    txHash: string,
    fromChainId: ChainId,
    toChainId: ChainId,
  ): Promise<StatusResponse> {
    const status = await getStatus({
      txHash,
      fromChain: fromChainId,
      toChain: toChainId,
    })
    return status
  }

  /**
   * Get supported tokens for a chain
   */
  async getTokensForChain(chainId: ChainId): Promise<Token[]> {
    const result = await getTokens({ chains: [chainId] })
    return result.tokens[chainId] || []
  }

  /**
   * Get supported chains
   */
  async getSupportedChains(): Promise<ExtendedChain[]> {
    return await getChains()
  }

  /**
   * Map priority to Li.Fi sort order
   */
  private getPriorityOrder(
    priority: BridgePriority,
  ): "FASTEST" | "CHEAPEST" | "RECOMMENDED" {
    switch (priority) {
      case "fastest":
        return "FASTEST"
      case "cheapest":
        return "CHEAPEST"
      case "balanced":
      default:
        return "RECOMMENDED"
    }
  }

  /**
   * Create batch transactions for large amounts
   */
  createBatchTransactions(
    params: BridgeRouteParams,
    batchCount: number = 3,
  ): BridgeRouteParams[] {
    const totalAmount = BigInt(params.amount)
    const perBatch = totalAmount / BigInt(batchCount)
    const remainder =totalAmount % BigInt(batchCount)

    const batches: BridgeRouteParams[] = []

    for (let i = 0; i < batchCount; i++) {
      const batchAmount =
        i === batchCount - 1
          ? perBatch + remainder // Add remainder to last batch
          : perBatch

      batches.push({
        ...params,
        amount: batchAmount.toString(),
      })
    }

    return batches
  }

  /**
   * Execute bridge transaction using wallet signer
   * @param route - The route to execute
   * @param signer - Ethers.js signer for signing transactions
   * @returns Transaction hash
   * 
   * Note: Li.Fi SDK provides route data, actual execution is done by sending
   * the transaction through the signer directly
   */
  async executeBridgeTransaction(
    route: Route,
    signer: Signer,
  ): Promise<string> {
    try {
      console.log("[LiFiBridgeService] Preparing bridge transaction...")

      // Get the first step's transaction data
      if (!route.steps || route.steps.length === 0) {
        throw new Error("Route has no steps")
      }

      const firstStep = route.steps[0]
      if (!firstStep || !firstStep.transactionRequest) {
        throw new Error("No transaction request found in route")
      }

      const txRequest = firstStep.transactionRequest
      console.log("[LiFiBridgeService] Transaction request:", txRequest)

      // Send the transaction using the signer
      const tx = await signer.sendTransaction({
        to: txRequest.to as string,
        data: txRequest.data as string,
        value: txRequest.value ? BigInt(txRequest.value) : undefined,
        gasLimit: txRequest.gasLimit
          ? BigInt(txRequest.gasLimit)
          : undefined,
        gasPrice: txRequest.gasPrice
          ? BigInt(txRequest.gasPrice)
          : undefined,
      })

      console.log("[LiFiBridgeService] Transaction sent:", tx.hash)

      // Wait for transaction to be mined
      const receipt = await tx.wait()
      console.log("[LiFiBridgeService] Transaction confirmed:", receipt?.hash)

      return tx.hash
    } catch (error) {
      console.error("[LiFiBridgeService] Failed to execute bridge:", error)
      throw error
    }
  }
}

/**
 * Singleton instance
 */
export const liFiBridgeService = new LiFiBridgeService()
