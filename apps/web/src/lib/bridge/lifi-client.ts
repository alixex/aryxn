// apps/web/src/lib/bridge/lifi-client.ts

import type {
  LiFiRoute,
  LiFiRouteRequest,
  LiFiTransaction,
} from "./route-types"
import { mapBridgeError } from "./bridge-errors"
import { LIFI_API_URL } from "@aryxn/chain-constants"

// Li.Fi client timeout configuration
const LIFI_TIMEOUT = 30000 // 30s

interface LiFiRouteResponse {
  routes: Array<{
    id: string
    fromChain: {
      chainId: number
      coin: string
    }
    fromToken: {
      address: string
      symbol: string
      decimals: number
    }
    fromAmount: string
    toChain: {
      chainId: number
      coin: string
    }
    toToken: {
      address: string
      symbol: string
      decimals: number
    }
    toAmount: string
    steps: Array<{
      type: string
      tool: string
      toolData?: unknown
    }>
    gasCosts?: Array<{ amount: string; amountUSD: string }>
    containsGasStep: boolean
    tags: string[]
    insurance?: { state: string; insurableAmount: string }
  }>
}

interface LiFiStepsResponse {
  transactionRequest?: {
    to: string
    from: string
    data: string
    value?: string
    gasLimit?: string
    chainId?: number
  }
  estimate?: {
    duration: number
    slippage: number
  }
  execution?: {
    status: string
  }
}

interface LiFiStatusResponse {
  status: "NOT_FOUND" | "PENDING" | "DONE" | "FAILED"
  fromChain: { chainId: number }
  toChain: { chainId: number }
  process: Array<{
    type: string
    startedAt?: number
    status: string
  }>
}

/**
 * Li.Fi API client wrapper
 */
export class LiFiClient {
  private apiUrl: string

  constructor() {
    this.apiUrl = LIFI_API_URL
  }

  /**
   * Query routes from Li.Fi
   */
  async getRoutes(request: LiFiRouteRequest): Promise<LiFiRoute[]> {
    try {
      const params = new URLSearchParams({
        fromChain: this.normalizeChain(request.fromChain),
        toChain: this.normalizeChain(request.toChain),
        fromToken: request.fromToken,
        toToken: request.toToken,
        fromAmount: request.fromAmount,
        slippage: "0.005", // 0.5%
        allowSwitchChain: "false",
        allowDexs: "true", // Allow DEX swaps
        allowBridges: "true",
        deniedDexs: "", // No restrictions
        deniedBridges: "",
        preferredBridges: "stargate,across,socket", // Prefer stable bridges
      })

      const response = await this.fetchWithTimeout(
        `${this.apiUrl}/routes?${params}`,
        LIFI_TIMEOUT,
      )

      if (!response.ok) {
        throw new Error(`Li.Fi API error: ${response.status}`)
      }

      const data = (await response.json()) as LiFiRouteResponse

      if (!data.routes || data.routes.length === 0) {
        throw new Error("No routes found for this swap pair")
      }

      return data.routes.map((route) => this.parseRoute(route))
    } catch (error) {
      const mapped = mapBridgeError(error)
      throw new Error(mapped.message)
    }
  }

  /**
   * Get execution steps for a route
   */
  async getSteps(routeId: string): Promise<LiFiTransaction[]> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.apiUrl}/step?routeId=${routeId}`,
        LIFI_TIMEOUT,
      )

      if (!response.ok) {
        throw new Error(`Failed to get steps: ${response.status}`)
      }

      const data = (await response.json()) as LiFiStepsResponse

      if (!data.transactionRequest) {
        throw new Error("No transaction request in response")
      }

      // Li.Fi may return multiple tx steps, but typically one at a time
      return [
        {
          chainId: data.transactionRequest.chainId || 1,
          to: data.transactionRequest.to as `0x${string}`,
          from: data.transactionRequest.from as `0x${string}`,
          data: data.transactionRequest.data,
          value: data.transactionRequest.value,
          gasLimit: data.transactionRequest.gasLimit,
        },
      ]
    } catch (error) {
      const mapped = mapBridgeError(error)
      throw new Error(mapped.message)
    }
  }

  /**
   * Poll for route status
   */
  async getStatus(
    routeId: string,
    txHash: string,
  ): Promise<{
    status: "pending" | "completed" | "failed"
    progress: number // 0-100
    message: string
  }> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.apiUrl}/status?routeId=${routeId}&txHash=${txHash}`,
        LIFI_TIMEOUT,
      )

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`)
      }

      const data = (await response.json()) as LiFiStatusResponse

      let progress = 0
      let status: "pending" | "completed" | "failed" = "pending"

      if (data.status === "DONE") {
        status = "completed"
        progress = 100
      } else if (data.status === "FAILED") {
        status = "failed"
        progress = 100
      } else if (data.process && data.process.length > 0) {
        progress = Math.min(
          50 *
            (data.process.filter((p) => p.status === "DONE").length /
              data.process.length),
          90,
        )
      }

      return {
        status,
        progress,
        message: this.getStatusMessageKey(data),
      }
    } catch (error) {
      return {
        status: "pending",
        progress: 0,
        message: "bridge.statusCheckFailed",
      }
    }
  }

  /**
   * Validate route execution is possible
   */
  async validateRoute(
    routeId: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    if (!routeId || !routeId.trim()) {
      return {
        valid: false,
        errors: ["Missing route id"],
      }
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.apiUrl}/step?routeId=${encodeURIComponent(routeId)}`,
        LIFI_TIMEOUT,
      )

      if (!response.ok) {
        if (response.status === 404) {
          errors.push("Route not found or expired")
        } else {
          errors.push(`Route validation failed: ${response.status}`)
        }

        return {
          valid: false,
          errors,
        }
      }

      const data = (await response.json()) as LiFiStepsResponse

      if (!data.transactionRequest) {
        errors.push("Route is not executable: missing transaction request")
      }

      if (data.execution?.status?.toUpperCase() === "FAILED") {
        errors.push("Route execution status is failed")
      }

      return {
        valid: errors.length === 0,
        errors,
      }
    } catch (error) {
      const mapped = mapBridgeError(error)
      return {
        valid: false,
        errors: [mapped.message],
      }
    }
  }

  // ========== Private helpers ==========

  private normalizeChain(chain: string): string {
    // Normalize chain names to Li.Fi format
    const mapping: Record<string, string> = {
      Bitcoin: "BTC",
      bitcoin: "BTC",
      BTC: "BTC",
      Ethereum: "ETH",
      ethereum: "ETH",
      ETH: "ETH",
      Solana: "SOL",
      solana: "SOL",
      SOL: "SOL",
      Arweave: "AR",
      arweave: "AR",
      AR: "AR",
      Arbitrum: "ARB",
      arbitrum: "ARB",
      ARB: "ARB",
      Optimism: "OPTI",
      optimism: "OPTI",
      OPTI: "OPTI",
      Polygon: "POLY",
      polygon: "POLY",
      POLY: "POLY",
    }
    return mapping[chain] || chain
  }

  private parseRoute(raw: any): LiFiRoute {
    return {
      id: raw.id,
      fromChain: raw.fromChain.coin,
      toChain: raw.toChain.coin,
      fromToken: {
        symbol: raw.fromToken.symbol,
        address: raw.fromToken.address,
        decimals: raw.fromToken.decimals,
      },
      toToken: {
        symbol: raw.toToken.symbol,
        address: raw.toToken.address,
        decimals: raw.toToken.decimals,
      },
      fromAmount: raw.fromAmount,
      toAmount: raw.toAmount,
      steps: raw.steps.map((step: any) => ({
        id: `${raw.id}-${step.type}`,
        type: step.type,
        tool: step.tool,
        fromToken: raw.fromToken,
        toToken: raw.toToken,
        fromAmount: raw.fromAmount,
        toAmount: raw.toAmount,
      })),
      estimate: {
        duration: 1800, // Default 30 min
        slippage: 0.005, // 0.5%
      },
      fees: {
        total: "0",
        percentage: 0.5,
        breakdown: {
          bridge: "0",
          swap: "0",
        },
      },
    }
  }

  private getStatusMessageKey(status: LiFiStatusResponse): string {
    if (status.status === "DONE") return "bridge.statusCompleted"
    if (status.status === "FAILED") return "bridge.statusFailed"
    if (status.process && status.process.length > 0) {
      const currentStep = status.process.find((p) => p.status !== "DONE")
      return currentStep?.type === "bridge"
        ? "bridge.statusBridging"
        : "bridge.statusSwapping"
    }
    return "bridge.statusProcessing"
  }

  private fetchWithTimeout(url: string, timeout: number): Promise<Response> {
    return Promise.race([
      fetch(url),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), timeout),
      ),
    ])
  }
}

// Singleton instance
let lifiClient: LiFiClient

export function getLiFiClient(): LiFiClient {
  if (!lifiClient) {
    lifiClient = new LiFiClient()
  }
  return lifiClient
}
