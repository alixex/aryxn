// apps/web/src/lib/bridge/route-types.ts

import type { Address } from "@aryxn/wallet-core"

/**
 * Request to query bridge routes
 */
export interface LiFiRouteRequest {
  fromChain: string
  fromToken: string
  fromAmount: string
  toChain: string
  toToken: string
}

/**
 * A single step in a route (bridge or swap)
 */
export interface RouteStep {
  id: string
  type: "bridge" | "swap" | "lifi-swap"
  tool: string
  toolData?: Record<string, unknown>
  fromToken: {
    symbol: string
    address: string
    decimals: number
  }
  toToken: {
    symbol: string
    address: string
    decimals: number
  }
  fromAmount: string
  toAmount: string
}

/**
 * Complete route from source to destination
 */
export interface LiFiRoute {
  id: string
  fromChain: string
  toChain: string
  fromToken: {
    symbol: string
    address: string
    decimals: number
  }
  toToken: {
    symbol: string
    address: string
    decimals: number
  }
  fromAmount: string
  toAmount: string
  steps: RouteStep[]
  estimate: {
    duration: number // seconds
    slippage: number // percentage
  }
  fees: {
    total: string // in destination token
    percentage: number
    breakdown: {
      bridge?: string
      swap?: string
      lifi?: string
    }
  }
}

/**
 * Execution transaction from Li.Fi
 */
export interface LiFiTransaction {
  chainId: number
  to: Address
  from: Address
  data: string
  value?: string
  gasLimit?: string
}

/**
 * Bridge swap transaction record
 */
export interface BridgeSwapRecord {
  id: string
  type: "BRIDGE_SWAP"
  direction: "forward" | "reverse"
  status: "PENDING" | "CONFIRMING" | "EXECUTING" | "COMPLETED" | "FAILED"

  fromChain: string
  toChain: string
  fromToken: string
  toToken: string

  fromAmount: string
  toAmount: string
  feePercentage: number

  bridgeProvider: string
  estimatedTime: number

  txHashes: string[]
  destinationAddress?: string

  errorMessage?: string
  createdAt: number
  updatedAt: number
}

/**
 * Bridge route query state
 */
export interface BridgeRouteState {
  loading: boolean
  data: LiFiRoute | null
  error: string | null
}

/**
 * Bridge swap execution state
 */
export interface BridgeSwapState {
  loading: boolean
  step: number // current step (1 of N)
  totalSteps: number
  status:
    | "idle"
    | "signing"
    | "broadcasting"
    | "confirming"
    | "complete"
    | "error"
  currentTxHash?: string
  error?: string
}
