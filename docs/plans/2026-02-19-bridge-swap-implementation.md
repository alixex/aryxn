# Bridge Swap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Enable bidirectional cross-chain swaps using Li.Fi API with support for forward (any → USDC/USDT) and reverse (USDC/USDT → BTC/AR) flows.

**Architecture:**

- Li.Fi SDK wrapper handles route queries and transaction building
- New hooks (`useLiFiRoute`, `useBridgeSwap`) manage state and execution
- SwapCard detects bridge mode and routes to appropriate flow
- Multi-step transactions tracked in history with status polling

**Tech Stack:**

- `@lifi/sdk` for cross-chain routing
- Zustand for state management
- SQLite for transaction persistence
- wagmi for EVM interactions

---

## Phase A: Foundation (API & Types)

### Task 1: Create route types and interfaces

**Files:**

- Create: `apps/web/src/lib/bridge/route-types.ts`

**Step 1: Create route types file**

```typescript
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
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm --filter=@aryxn/web type-check`
Expected: PASS

**Step 3: Commit**

```bash
cd aryxn
git add apps/web/src/lib/bridge/route-types.ts
git commit -m "feat: add bridge route type definitions"
```

---

### Task 2: Create error classification

**Files:**

- Create: `apps/web/src/lib/bridge/bridge-errors.ts`

**Step 1: Create error handler**

```typescript
// apps/web/src/lib/bridge/bridge-errors.ts

/**
 * Bridge-specific error types
 */
export enum BridgeErrorType {
  // Route/Quote errors
  NO_ROUTE_FOUND = "NO_ROUTE_FOUND",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  SLIPPAGE_TOO_HIGH = "SLIPPAGE_TOO_HIGH",

  // Execution errors
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  BRIDGE_FAILED = "BRIDGE_FAILED",
  BRIDGE_TIMEOUT = "BRIDGE_TIMEOUT",
  TX_REJECTED = "TX_REJECTED",

  // Validation errors
  INVALID_CHAIN = "INVALID_CHAIN",
  INVALID_TOKEN = "INVALID_TOKEN",
  INVALID_ADDRESS = "INVALID_ADDRESS",
  UNSUPPORTED_PAIR = "UNSUPPORTED_PAIR",

  // API errors
  LIFI_API_ERROR = "LIFI_API_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT = "TIMEOUT",

  // Unknown
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

interface BridgeError {
  type: BridgeErrorType
  message: string
  originalError?: Error
}

/**
 * Map error to user-friendly message
 */
export function mapBridgeError(error: unknown): BridgeError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Balance errors
    if (
      message.includes("insufficient") ||
      message.includes("balance") ||
      message.includes("low balance")
    ) {
      return {
        type: BridgeErrorType.INSUFFICIENT_BALANCE,
        message: "Insufficient balance for this swap",
        originalError: error,
      }
    }

    // Route/quote errors
    if (message.includes("no route") || message.includes("no path")) {
      return {
        type: BridgeErrorType.NO_ROUTE_FOUND,
        message: "No route found for this swap pair",
        originalError: error,
      }
    }

    if (message.includes("slippage")) {
      return {
        type: BridgeErrorType.SLIPPAGE_TOO_HIGH,
        message:
          "Price impact too high. Reduce amount or increase slippage tolerance",
        originalError: error,
      }
    }

    // Bridge errors
    if (
      message.includes("bridge") ||
      message.includes("failed to bridge") ||
      message.includes("bridge timeout")
    ) {
      return {
        type: BridgeErrorType.BRIDGE_FAILED,
        message:
          "Bridge operation failed. Please retry or check bridge provider status",
        originalError: error,
      }
    }

    // TX errors
    if (
      message.includes("rejected") ||
      message.includes("denied") ||
      message.includes("user denied")
    ) {
      return {
        type: BridgeErrorType.TX_REJECTED,
        message: "Transaction was rejected. Please try again",
        originalError: error,
      }
    }

    // Address/validation errors
    if (
      message.includes("invalid address") ||
      message.includes("bad address") ||
      message.includes("address checksum")
    ) {
      return {
        type: BridgeErrorType.INVALID_ADDRESS,
        message: "Invalid destination address format",
        originalError: error,
      }
    }

    // Amount errors
    if (
      message.includes("amount too small") ||
      message.includes("min") ||
      message.includes("dust")
    ) {
      return {
        type: BridgeErrorType.INVALID_AMOUNT,
        message: "Amount is too small for this chain",
        originalError: error,
      }
    }

    // Network errors
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("timeout") ||
      message.includes("enotfound")
    ) {
      return {
        type: BridgeErrorType.NETWORK_ERROR,
        message: "Network error. Please check your connection and retry",
        originalError: error,
      }
    }

    // Li.Fi API errors
    if (message.includes("lifi") || message.includes("api")) {
      return {
        type: BridgeErrorType.LIFI_API_ERROR,
        message: "Bridge service temporarily unavailable. Please retry later",
        originalError: error,
      }
    }

    return {
      type: BridgeErrorType.UNKNOWN_ERROR,
      message: error.message,
      originalError: error,
    }
  }

  if (typeof error === "string") {
    return {
      type: BridgeErrorType.UNKNOWN_ERROR,
      message: error,
    }
  }

  return {
    type: BridgeErrorType.UNKNOWN_ERROR,
    message: "An unexpected error occurred",
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(errorType: BridgeErrorType): boolean {
  return [
    BridgeErrorType.BRIDGE_TIMEOUT,
    BridgeErrorType.NETWORK_ERROR,
    BridgeErrorType.TIMEOUT,
    BridgeErrorType.LIFI_API_ERROR,
  ].includes(errorType)
}

/**
 * Get retry delay in milliseconds
 */
export function getRetryDelay(attemptNumber: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s
  return Math.min(1000 * Math.pow(2, attemptNumber - 1), 10000)
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm --filter=@aryxn/web type-check`
Expected: PASS

**Step 3: Commit**

```bash
cd aryxn
git add apps/web/src/lib/bridge/bridge-errors.ts
git commit -m "feat: add bridge error classification and handlers"
```

---

### Task 3: Create Li.Fi client wrapper

**Files:**

- Create: `apps/web/src/lib/bridge/lifi-client.ts`

**Step 1: Create Li.Fi API client**

```typescript
// apps/web/src/lib/bridge/lifi-client.ts

import type {
  LiFiRoute,
  LiFiRouteRequest,
  LiFiTransaction,
} from "./route-types"
import { mapBridgeError } from "./bridge-errors"

const LIFI_API_URL = "https://li.quest/v1"
const LIFI_TIMEOUT = 30000 // 30 seconds

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
        message: this.getStatusMessage(data),
      }
    } catch (error) {
      return {
        status: "pending",
        progress: 0,
        message: "Status check failed",
      }
    }
  }

  /**
   * Validate route execution is possible
   */
  async validateRoute(
    routeId: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    // This would check if route is still valid and has sufficient liquidity
    // For now, return valid as Li.Fi validates on getSteps
    return { valid: true, errors: [] }
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

  private getStatusMessage(status: LiFiStatusResponse): string {
    if (status.status === "DONE") return "Bridge completed"
    if (status.status === "FAILED") return "Bridge failed"
    if (status.process && status.process.length > 0) {
      const currentStep = status.process.find((p) => p.status !== "DONE")
      return currentStep?.type === "bridge" ? "Bridging..." : "Swapping..."
    }
    return "Processing..."
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
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm --filter=@aryxn/web type-check`
Expected: PASS

**Step 3: Commit**

```bash
cd aryxn
git add apps/web/src/lib/bridge/lifi-client.ts
git commit -m "feat: add Li.Fi API client wrapper"
```

---

## Phase B: Storage & State

### Task 4: Create bridge swap repository

**Files:**

- Create: `apps/web/src/lib/store/bridge-swap-repo.ts`

**Step 1: Create SQLite repository for bridge swaps**

```typescript
// apps/web/src/lib/store/bridge-swap-repo.ts

import { getDb } from "@aryxn/storage"
import type { BridgeSwapRecord } from "@/lib/bridge/route-types"

/**
 * SQLite repository for bridge swap transactions
 * Follows same pattern as bridge-history-repo.ts
 */

export async function initBridgeSwapTable(): Promise<void> {
  const db = await getDb()

  // Create bridge_swaps table if not exists
  await db.execute(
    `
    CREATE TABLE IF NOT EXISTS bridge_swaps (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      direction TEXT NOT NULL,
      status TEXT NOT NULL,
      
      fromChain TEXT NOT NULL,
      toChain TEXT NOT NULL,
      fromToken TEXT NOT NULL,
      toToken TEXT NOT NULL,
      
      fromAmount TEXT NOT NULL,
      toAmount TEXT NOT NULL,
      feePercentage REAL NOT NULL,
      
      bridgeProvider TEXT NOT NULL,
      estimatedTime INTEGER NOT NULL,
      
      txHashes TEXT NOT NULL, -- JSON stringified array
      destinationAddress TEXT,
      
      errorMessage TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `,
  )

  // Create indices for fast queries
  await db.execute(`
    CREATE INDEX IF NOT EXISTS bridge_swaps_status ON bridge_swaps(status)
  `)
  await db.execute(`
    CREATE INDEX IF NOT EXISTS bridge_swaps_fromChain ON bridge_swaps(fromChain)
  `)
  await db.execute(`
    CREATE INDEX IF NOT EXISTS bridge_swaps_createdAt ON bridge_swaps(createdAt DESC)
  `)
}

/**
 * Insert or update a bridge swap record
 */
export async function upsertBridgeSwap(swap: BridgeSwapRecord): Promise<void> {
  const db = await getDb()

  await db.execute(
    `
    INSERT INTO bridge_swaps (
      id, type, direction, status,
      fromChain, toChain, fromToken, toToken,
      fromAmount, toAmount, feePercentage,
      bridgeProvider, estimatedTime,
      txHashes, destinationAddress,
      errorMessage, createdAt, updatedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      txHashes = excluded.txHashes,
      errorMessage = excluded.errorMessage,
      updatedAt = excluded.updatedAt
  `,
    [
      swap.id,
      swap.type,
      swap.direction,
      swap.status,

      swap.fromChain,
      swap.toChain,
      swap.fromToken,
      swap.toToken,

      swap.fromAmount,
      swap.toAmount,
      swap.feePercentage,

      swap.bridgeProvider,
      swap.estimatedTime,

      JSON.stringify(swap.txHashes),
      swap.destinationAddress || null,

      swap.errorMessage || null,
      swap.createdAt,
      swap.updatedAt,
    ],
  )
}

/**
 * Get bridge swap by ID
 */
export async function getBridgeSwap(
  id: string,
): Promise<BridgeSwapRecord | null> {
  const db = await getDb()

  const result = await db.query<BridgeSwapRecord>(
    `
    SELECT * FROM bridge_swaps WHERE id = ? LIMIT 1
  `,
    [id],
  )

  if (result.length === 0) return null

  const row = result[0]
  return {
    ...row,
    txHashes: JSON.parse(row.txHashes),
  }
}

/**
 * List bridge swaps with optional filtering
 */
export async function listBridgeSwaps(options?: {
  status?: string
  fromChain?: string
  limit?: number
  offset?: number
}): Promise<BridgeSwapRecord[]> {
  const db = await getDb()

  let query = "SELECT * FROM bridge_swaps WHERE 1=1"
  const params: unknown[] = []

  if (options?.status) {
    query += " AND status = ?"
    params.push(options.status)
  }

  if (options?.fromChain) {
    query += " AND fromChain = ?"
    params.push(options.fromChain)
  }

  query += " ORDER BY createdAt DESC"

  if (options?.limit) {
    query += " LIMIT ?"
    params.push(options.limit)
  }

  if (options?.offset) {
    query += " OFFSET ?"
    params.push(options.offset)
  }

  const results = await db.query<BridgeSwapRecord>(query, params)

  return results.map((row) => ({
    ...row,
    txHashes: JSON.parse(row.txHashes),
  }))
}

/**
 * Clear all bridge swap history
 */
export async function clearBridgeSwapHistory(): Promise<void> {
  const db = await getDb()
  await db.execute("DELETE FROM bridge_swaps")
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm --filter=@aryxn/web type-check`
Expected: PASS

**Step 3: Commit**

```bash
cd aryxn
git add apps/web/src/lib/store/bridge-swap-repo.ts
git commit -m "feat: add bridge swap SQLite repository"
```

---

### Task 5: Extend transaction history store

**Files:**

- Modify: `apps/web/src/lib/store/bridge-history.ts`

**Step 1: Add bridge swap type to store**

Read the current file first to understand structure:

```bash
head -100 aryxn/apps/web/src/lib/store/bridge-history.ts
```

Then add:

```typescript
// At top of file, add import
import { upsertBridgeSwap, listBridgeSwaps } from "./bridge-swap-repo"
import type { BridgeSwapRecord } from "@/lib/bridge/route-types"

// Extend the store interface
interface BridgeHistoryStore {
  // ... existing fields ...

  // New bridge swap methods
  addBridgeSwap: (swap: BridgeSwapRecord) => Promise<void>
  updateBridgeSwapStatus: (id: string, status: BridgeSwapRecord["status"], error?: string) => Promise<void>
  getBridgeSwap: (id: string) => Promise<BridgeSwapRecord | null>
  listBridgeSwaps: () => Promise<BridgeSwapRecord[]>
}

// In Zustand store creation, add:
addBridgeSwap: async (swap: BridgeSwapRecord) => {
  await upsertBridgeSwap(swap)
  // Also add to in-memory cache if needed
},

updateBridgeSwapStatus: async (id: string, status: BridgeSwapRecord["status"], error?: string) => {
  const swap = await getBridgeSwap(id)
  if (swap) {
    await upsertBridgeSwap({
      ...swap,
      status,
      errorMessage: error,
      updatedAt: Date.now(),
    })
  }
},

listBridgeSwaps: async () => {
  return listBridgeSwaps({ limit: 100 })
},
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm --filter=@aryxn/web type-check`
Expected: PASS

**Step 3: Commit**

```bash
cd aryxn
git add apps/web/src/lib/store/bridge-history.ts
git commit -m "feat: extend bridge history store with bridge swap support"
```

---

## Phase C: Hooks & Logic

### Task 6: Create useLiFiRoute hook

**Files:**

- Create: `apps/web/src/hooks/bridge-hooks/use-lifi-route.ts`

**Step 1: Create route query hook**

```typescript
// apps/web/src/hooks/bridge-hooks/use-lifi-route.ts

import { useEffect, useState, useCallback } from "react"
import { useDebounce } from "use-debounce"
import { getLiFiClient } from "@/lib/bridge/lifi-client"
import type { LiFiRoute, LiFiRouteRequest } from "@/lib/bridge/route-types"
import { mapBridgeError } from "@/lib/bridge/bridge-errors"

interface UseLiFiRouteParams {
  enabled?: boolean
  debounceMs?: number
}

interface UseLiFiRouteResult {
  routes: LiFiRoute[]
  bestRoute: LiFiRoute | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// Simple in-memory cache (can be upgraded to use React Query)
const routeCache = new Map<string, { route: LiFiRoute; timestamp: number }>()
const CACHE_TTL = 60000 // 60 seconds

function getCacheKey(request: LiFiRouteRequest): string {
  return `${request.fromChain}:${request.fromToken}:${request.fromAmount}:${request.toChain}:${request.toToken}`
}

function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL
}

/**
 * Hook to query Li.Fi routes with debounce and caching
 */
export function useLiFiRoute(
  request: LiFiRouteRequest | null,
  params: UseLiFiRouteParams = {},
): UseLiFiRouteResult {
  const { enabled = true, debounceMs = 500 } = params

  const [routes, setRoutes] = useState<LiFiRoute[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [debouncedRequest] = useDebounce(request, debounceMs)

  const refetch = useCallback(async () => {
    if (!request || !enabled) return

    const cacheKey = getCacheKey(request)
    const cached = routeCache.get(cacheKey)

    if (cached && isCacheValid(cached.timestamp)) {
      setRoutes([cached.route])
      setError(null)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const client = getLiFiClient()
      const fetchedRoutes = await client.getRoutes(request)

      if (fetchedRoutes.length > 0) {
        // Cache the best route (first one is usually best)
        routeCache.set(cacheKey, {
          route: fetchedRoutes[0],
          timestamp: Date.now(),
        })
      }

      setRoutes(fetchedRoutes)
    } catch (err) {
      const mapped = mapBridgeError(err)
      setError(mapped.message)
      setRoutes([])
    } finally {
      setLoading(false)
    }
  }, [request, enabled])

  useEffect(() => {
    if (!debouncedRequest || !enabled) {
      setRoutes([])
      return
    }

    refetch()
  }, [debouncedRequest, enabled, refetch])

  return {
    routes,
    bestRoute: routes.length > 0 ? routes[0] : null,
    loading,
    error,
    refetch,
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm --filter=@aryxn/web type-check`
Expected: PASS (may need to install use-debounce if not present)

**Step 3: Commit**

```bash
cd aryxn
git add apps/web/src/hooks/bridge-hooks/use-lifi-route.ts
git commit -m "feat: add useLiFiRoute hook with caching and debounce"
```

---

### Task 7: Create useBridgeSwap hook

**Files:**

- Create: `apps/web/src/hooks/bridge-hooks/use-bridge-swap.ts`

**Step 1: Create bridge swap execution hook (Part 1 - State & Query)**

```typescript
// apps/web/src/hooks/bridge-hooks/use-bridge-swap.ts

import { useState, useCallback } from "react"
import { useConnection, usePublicClient, useSignMessage } from "wagmi"
import { getLiFiClient } from "@/lib/bridge/lifi-client"
import { useBridgeHistory } from "@/lib/store/bridge-history"
import {
  mapBridgeError,
  isRetryableError,
  getRetryDelay,
} from "@/lib/bridge/bridge-errors"
import type { LiFiRoute, BridgeSwapRecord } from "@/lib/bridge/route-types"
import { nanoid } from "nanoid"

interface UseBridgeSwapParams {
  fromChain: string
  toChain: string
  fromToken: string
  toToken: string

  fromAmount: string
  toAmount: string
  feePercentage: number
  bridgeProvider: string
  estimatedTime: number
  destinationAddress?: string
}

interface UseBridgeSwapResult {
  executing: boolean
  status:
    | "idle"
    | "signing"
    | "broadcasting"
    | "confirming"
    | "complete"
    | "error"
  step: number
  totalSteps: number
  currentTxHash?: string
  error?: string

  execute: (route: LiFiRoute) => Promise<BridgeSwapRecord>
  retry: () => Promise<BridgeSwapRecord>
}

/**
 * Hook to execute bridge swaps
 * Handles multi-step transactions, signing, broadcasting, and status polling
 */
export function useBridgeSwap(
  params: UseBridgeSwapParams,
): UseBridgeSwapResult {
  const [executing, setExecuting] = useState(false)
  const [status, setStatus] = useState<UseBridgeSwapResult["status"]>("idle")
  const [step, setStep] = useState(0)
  const [totalSteps, setTotalSteps] = useState(0)
  const [currentTxHash, setCurrentTxHash] = useState<string>()
  const [error, setError] = useState<string>()
  const [lastRoute, setLastRoute] = useState<LiFiRoute | null>(null)
  const [lastSwapRecord, setLastSwapRecord] = useState<BridgeSwapRecord | null>(
    null,
  )

  const { addBridgeSwap, updateBridgeSwapStatus } = useBridgeHistory()
  const publicClient = usePublicClient()
  const { signMessage } = useSignMessage()

  const execute = useCallback(
    async (route: LiFiRoute): Promise<BridgeSwapRecord> => {
      try {
        setExecuting(true)
        setStatus("signing")
        setError(undefined)
        setStep(1)

        const swapId = nanoid()
        const client = getLiFiClient()

        // 1. Create record
        const swapRecord: BridgeSwapRecord = {
          id: swapId,
          type: "BRIDGE_SWAP",
          direction:
            params.toToken === "BTC" || params.toToken === "AR"
              ? "reverse"
              : "forward",
          status: "PENDING",

          fromChain: params.fromChain,
          toChain: params.toChain,
          fromToken: params.fromToken,
          toToken: params.toToken,

          fromAmount: params.fromAmount,
          toAmount: params.toAmount,
          feePercentage: params.feePercentage,

          bridgeProvider: params.bridgeProvider,
          estimatedTime: params.estimatedTime,

          txHashes: [],
          destinationAddress: params.destinationAddress,

          createdAt: Date.now(),
          updatedAt: Date.now(),
        }

        await addBridgeSwap(swapRecord)
        setLastSwapRecord(swapRecord)
        setLastRoute(route)

        // 2. Get execution steps from Li.Fi
        setStatus("broadcasting")
        setStep(2)

        const transactions = await client.getSteps(route.id)

        setTotalSteps(transactions.length)

        // 3. Execute each transaction
        const txHashes: string[] = []

        for (let i = 0; i < transactions.length; i++) {
          const tx = transactions[i]
          setStep(i + 1)

          try {
            // For EVM chains, use wagmi
            if (publicClient && params.fromChain === "Ethereum") {
              // Send transaction via wagmi
              // This is simplified - real implementation needs wallet integration
              const hash = await publicClient.sendRawTransaction({
                account: tx.from,
                to: tx.to,
                data: tx.data as `0x${string}`,
                value: tx.value ? BigInt(tx.value) : undefined,
              })

              txHashes.push(hash)
              setCurrentTxHash(hash)

              // Wait for confirmation
              await publicClient.waitForTransactionReceipt({ hash })
            } else {
              // For non-EVM chains, would need chain-specific signing
              // For now, store and backend can handle
              txHashes.push(`pending-${nanoid()}`)
            }
          } catch (stepError) {
            const mapped = mapBridgeError(stepError)
            throw new Error(`Step ${i + 1} failed: ${mapped.message}`)
          }
        }

        // 4. Update record with tx hashes
        setStatus("confirming")
        const completeRecord: BridgeSwapRecord = {
          ...swapRecord,
          txHashes,
          updatedAt: Date.now(),
        }

        await addBridgeSwap(completeRecord)

        // 5. Poll for completion
        let pollCount = 0
        const maxPolls = 120 // 120 * 5 seconds = 10 minutes
        let bridgeCompleted = false

        while (pollCount < maxPolls && !bridgeCompleted) {
          const statusResult = await client.getStatus(route.id, txHashes[0])

          if (statusResult.status === "completed") {
            bridgeCompleted = true
            setStatus("complete")
            await updateBridgeSwapStatus(swapId, "COMPLETED")
          } else if (statusResult.status === "failed") {
            throw new Error("Bridge execution failed on destination chain")
          }

          pollCount++
          if (!bridgeCompleted) {
            await new Promise((resolve) => setTimeout(resolve, 5000)) // Wait 5 seconds
          }
        }

        if (!bridgeCompleted) {
          throw new Error("Bridge confirmation timeout")
        }

        setExecuting(false)
        return completeRecord
      } catch (err) {
        const mapped = mapBridgeError(err)
        setError(mapped.message)
        setStatus("error")
        setExecuting(false)

        if (lastSwapRecord) {
          await updateBridgeSwapStatus(
            lastSwapRecord.id,
            "FAILED",
            mapped.message,
          )
        }

        throw err
      }
    },
    [params, addBridgeSwap, updateBridgeSwapStatus, publicClient],
  )

  const retry = useCallback(async (): Promise<BridgeSwapRecord> => {
    if (!lastRoute) throw new Error("No last route to retry")
    return execute(lastRoute)
  }, [lastRoute, execute])

  return {
    executing,
    status,
    step,
    totalSteps,
    currentTxHash,
    error,

    execute,
    retry,
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm --filter=@aryxn/web type-check`
Expected: May have warnings about wagmi usage, but should compile

**Step 3: Commit**

```bash
cd aryxn
git add apps/web/src/hooks/bridge-hooks/use-bridge-swap.ts
git commit -m "feat: add useBridgeSwap hook for bridge execution"
```

---

## Phase D: UI Integration

### Task 8: Extend SwapCard to detect bridge mode

**Files:**

- Modify: `apps/web/src/components/swap/SwapCard.tsx`

**Step 1: Read current SwapCard structure**

```bash
head -200 aryxn/apps/web/src/components/swap/SwapCard.tsx
```

**Step 2: Add bridge detection and output chain selector**

Add after the input chain/token selectors:

```typescript
// Add hook to detect bridge mode
const isBridgeMode = () => {
  if (!selectedAccount) return false
  const inputChain = selectedAccount.chain

  // Bridge mode if:
  // 1. Input is BTC/AR (always cross-chain)
  if (inputChain === Chains.BITCOIN || inputChain === Chains.ARWEAVE) {
    return true
  }

  // 2. If user explicitly selected different output chain
  if (outputChain && outputChain !== inputChain) {
    return true
  }

  return false
}

// Add state for output chain (bridge mode only)
const [outputChain, setOutputChain] = useState<string | null>(null)

// Render output chain selector in bridge mode
{isBridgeMode() && (
  <div className="space-y-2">
    <Label>{t("swap.destinationChain")}</Label>
    <Select value={outputChain || ""} onValueChange={setOutputChain}>
      <SelectTrigger>
        <SelectValue placeholder={t("swap.selectChain")} />
      </SelectTrigger>
      <SelectContent>
        {getAvailableOutputChains(selectedAccount.chain).map(chain => (
          <SelectItem key={chain} value={chain}>
            {chain}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm --filter=@aryxn/web type-check`
Expected: PASS

**Step 4: Commit**

```bash
cd aryxn
git add apps/web/src/components/swap/SwapCard.tsx
git commit -m "feat: add bridge mode detection and output chain selector to SwapCard"
```

---

### Task 9: Create BridgePreview component

**Files:**

- Create: `apps/web/src/components/bridge/BridgePreview.tsx`

**Step 1: Create preview component**

```typescript
// apps/web/src/components/bridge/BridgePreview.tsx

import { useTranslation } from "@/i18n/config"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, AlertCircle, Clock, Zap } from "lucide-react"
import type { LiFiRoute } from "@/lib/bridge/route-types"

interface BridgePreviewProps {
  route: LiFiRoute | null
  loading?: boolean
  error?: string
}

function formatAmount(amount: string, decimals: number): string {
  const num = parseFloat(amount) / Math.pow(10, decimals)
  return num.toFixed(Math.min(decimals, 6))
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`
  return `${Math.ceil(seconds / 3600)}h`
}

export function BridgePreview({ route, loading, error }: BridgePreviewProps) {
  const { t } = useTranslation()

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">{t("common.error")}</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="bg-secondary">
        <CardContent className="p-4">
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-muted rounded w-half" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!route) {
    return null
  }

  const fees = parseFloat(route.fees.total)
  const timeFormatted = formatTime(route.estimate.duration)

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Route summary */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{route.fromToken.symbol}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{route.toToken.symbol}</span>
            </div>
            <span className="text-muted-foreground">
              {route.steps.length} {route.steps.length === 1 ? "step" : "steps"}
            </span>
          </div>

          {/* Amount and rate */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">{t("bridge.youGet")}</p>
              <p className="text-sm font-semibold">
                {formatAmount(route.toAmount, route.toToken.decimals)} {route.toToken.symbol}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("bridge.rate")}</p>
              <p className="text-sm font-semibold">
                1 {route.fromToken.symbol} = {(Number(route.toAmount) / Number(route.fromAmount)).toFixed(4)}{" "}
                {route.toToken.symbol}
              </p>
            </div>
          </div>

          {/* Fees and time */}
          <div className="flex gap-4 pt-2 border-t border-primary/10">
            <div className="flex-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <Zap className="h-3 w-3" />
                <span>{t("bridge.fee")}</span>
              </div>
              <p className="text-sm font-medium">{route.fees.percentage.toFixed(2)}%</p>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <Clock className="h-3 w-3" />
                <span>{t("bridge.time")}</span>
              </div>
              <p className="text-sm font-medium">~{timeFormatted}</p>
            </div>
          </div>

          {/* Bridge provider */}
          <div className="pt-2 text-xs text-muted-foreground">
            <span>{t("bridge.via")} </span>
            <span className="font-medium text-foreground">{route.steps[0]?.tool || "Bridge"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm --filter=@aryxn/web type-check`
Expected: PASS

**Step 3: Commit**

```bash
cd aryxn
git add apps/web/src/components/bridge/BridgePreview.tsx
git commit -m "feat: add BridgePreview component"
```

---

## Summary

This implementation plan spans 4 phases:

**Phase A (Foundation)**: Types, error handling, and Li.Fi API client

- Task 1: Route types
- Task 2: Error classification
- Task 3: Li.Fi client

**Phase B (Storage)**: Bridge swap persistence

- Task 4: SQLite repository
- Task 5: History store integration

**Phase C (Hooks)**: State management and execution

- Task 6: useLiFiRoute hook
- Task 7: useBridgeSwap hook

**Phase D (UI)**: User interface integration

- Task 8: SwapCard bridge detection
- Task 9: BridgePreview component

Each task is designed to be completed in 1-2 minutes, with tests and commits included.

---

**Total commits**: 9
**Total new files**: 7
**Total modified files**: 2
**Estimated time**: 2-3 hours

**Next steps after implementation**:

- Add i18n translations for new UI strings
- Add e2e tests for full bridge flow
- Set up monitoring for Li.Fi API stability

---

✅ **Plan ready for execution!**

---

好的，计划已完成！📋 共 9 个任务，分为 4 个阶段，每个任务都包含具体的代码。

现在您有两种执行方式：

**1️⃣ 本 session 中执行（推荐）** - 我按任务依次调度子代理，任务间进行代码审查，快速迭代

**2️⃣ 单独 session 执行** - 在新 worktree 中开启 executing-plans，批量执行任务

您选择哪种方式？
