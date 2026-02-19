import { type DbRow } from "@aryxn/storage"
import { db } from "@/lib/database"
import type { BridgeTransaction } from "./bridge-history"

type BridgeTransactionRow = DbRow & {
  id: string
  type: BridgeTransaction["type"]
  status: BridgeTransaction["status"]
  description: string
  timestamp: number
  hash: string | null
  from_chain: string | null
  to_chain: string | null
  amount: string | null
  token: string | null
  last_update: number | null
  from_chain_id: number | null
  to_chain_id: number | null
}

function mapRowToTransaction(row: BridgeTransactionRow): BridgeTransaction {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    description: row.description,
    timestamp: row.timestamp,
    hash: row.hash ?? undefined,
    fromChain: row.from_chain ?? undefined,
    toChain: row.to_chain ?? undefined,
    amount: row.amount ?? undefined,
    token: row.token ?? undefined,
    lastUpdate: row.last_update ?? undefined,
    fromChainId: row.from_chain_id ?? undefined,
    toChainId: row.to_chain_id ?? undefined,
  }
}

export async function listBridgeTransactions(
  limit = 100,
): Promise<BridgeTransaction[]> {
  const rows = (await db.all(
    `SELECT
      id,
      type,
      status,
      description,
      timestamp,
      hash,
      from_chain,
      to_chain,
      amount,
      token,
      last_update,
      from_chain_id,
      to_chain_id
    FROM bridge_transactions
    ORDER BY timestamp DESC
    LIMIT ?`,
    [limit],
  )) as BridgeTransactionRow[]

  return rows.map(mapRowToTransaction)
}

export async function upsertBridgeTransaction(tx: BridgeTransaction) {
  let targetId = tx.id

  if (tx.hash) {
    const existing = (await db.get(
      "SELECT id FROM bridge_transactions WHERE hash = ? LIMIT 1",
      [tx.hash],
    )) as { id?: string } | null

    if (existing?.id) {
      targetId = existing.id
    }
  }

  const now = Date.now()

  await db.run(
    `INSERT INTO bridge_transactions (
      id,
      type,
      status,
      description,
      timestamp,
      hash,
      from_chain,
      to_chain,
      amount,
      token,
      last_update,
      from_chain_id,
      to_chain_id,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      type = excluded.type,
      status = excluded.status,
      description = excluded.description,
      timestamp = excluded.timestamp,
      hash = excluded.hash,
      from_chain = excluded.from_chain,
      to_chain = excluded.to_chain,
      amount = excluded.amount,
      token = excluded.token,
      last_update = excluded.last_update,
      from_chain_id = excluded.from_chain_id,
      to_chain_id = excluded.to_chain_id,
      updated_at = excluded.updated_at`,
    [
      targetId,
      tx.type,
      tx.status,
      tx.description,
      tx.timestamp,
      tx.hash ?? null,
      tx.fromChain ?? null,
      tx.toChain ?? null,
      tx.amount ?? null,
      tx.token ?? null,
      tx.lastUpdate ?? null,
      tx.fromChainId ?? null,
      tx.toChainId ?? null,
      now,
    ],
  )
}

export async function clearBridgeTransactions() {
  await db.run("DELETE FROM bridge_transactions")
}

function syncMetadataKey(key: string) {
  return `bridge_history_sync:${key}`
}

export async function getBridgeSyncTimestamp(key: string): Promise<number> {
  const record = (await db.get(
    "SELECT value FROM vault_metadata WHERE key = ? LIMIT 1",
    [syncMetadataKey(key)],
  )) as { value?: string } | null

  if (!record?.value) return 0
  const parsed = Number(record.value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function setBridgeSyncTimestamp(key: string, timestamp: number) {
  await db.run(
    `INSERT INTO vault_metadata (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [syncMetadataKey(key), String(timestamp)],
  )
}
