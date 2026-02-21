// apps/web/src/lib/store/bridge-swap-repo.ts

import { type DbRow } from "@aryxn/storage"
import { db } from "@/lib/database"
import type { BridgeSwapRecord } from "@/lib/bridge/route-types"

/**
 * SQLite repository for bridge swap transactions
 * Follows same pattern as bridge-history-repo.ts
 */

type BridgeSwapRow = DbRow & {
  id: string
  type: string
  direction: string
  status: string
  fromChain: string
  toChain: string
  fromToken: string
  toToken: string
  fromAmount: string
  toAmount: string
  feePercentage: number
  bridgeProvider: string
  estimatedTime: number
  txHashes: string
  destinationAddress: string | null
  errorMessage: string | null
  createdAt: number
  updatedAt: number
}

function mapRowToSwap(row: BridgeSwapRow): BridgeSwapRecord {
  return {
    id: row.id,
    type: row.type as BridgeSwapRecord["type"],
    direction: row.direction as BridgeSwapRecord["direction"],
    status: row.status as BridgeSwapRecord["status"],
    fromChain: row.fromChain,
    toChain: row.toChain,
    fromToken: row.fromToken,
    toToken: row.toToken,
    fromAmount: row.fromAmount,
    toAmount: row.toAmount,
    feePercentage: row.feePercentage,
    bridgeProvider: row.bridgeProvider,
    estimatedTime: row.estimatedTime,
    txHashes: JSON.parse(row.txHashes),
    destinationAddress: row.destinationAddress ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function initBridgeSwapTable(): Promise<void> {
  // Create bridge_swaps table if not exists
  await db.exec(
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
      
      txHashes TEXT NOT NULL,
      destinationAddress TEXT,
      
      errorMessage TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `,
  )

  // Create indices for fast queries
  await db.exec(`
    CREATE INDEX IF NOT EXISTS bridge_swaps_status ON bridge_swaps(status)
  `)
  await db.exec(`
    CREATE INDEX IF NOT EXISTS bridge_swaps_fromChain ON bridge_swaps(fromChain)
  `)
  await db.exec(`
    CREATE INDEX IF NOT EXISTS bridge_swaps_createdAt ON bridge_swaps(createdAt DESC)
  `)
}

/**
 * Insert or update a bridge swap record
 */
export async function upsertBridgeSwap(swap: BridgeSwapRecord): Promise<void> {
  await db.run(
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
  const result = (await db.get(
    `SELECT * FROM bridge_swaps WHERE id = ? LIMIT 1`,
    [id],
  )) as BridgeSwapRow | null

  if (!result) return null

  return mapRowToSwap(result)
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

  const results = (await db.all(query, params)) as BridgeSwapRow[]

  return results.map(mapRowToSwap)
}

/**
 * Clear all bridge swap history
 */
export async function clearBridgeSwapHistory(): Promise<void> {
  await db.run("DELETE FROM bridge_swaps")
}
