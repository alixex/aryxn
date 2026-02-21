import { type DbRow } from "@aryxn/storage"
import { db } from "@/lib/database"
import type { BridgeTransaction } from "./bridge-history"
import { encryptData, decryptData, toBase64, fromBase64 } from "@aryxn/crypto"
import { getEncryptionKey } from "./encrypted-storage"

type BridgeTransactionRow = DbRow & {
  id: string
  user_address: string | null
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

async function encryptString(
  value: string | null | undefined,
): Promise<string | null> {
  if (!value) return null
  try {
    const key = await getEncryptionKey()
    const data = new TextEncoder().encode(value)
    const { ciphertext, nonce } = await encryptData(data, key)
    return `v1:${toBase64(nonce)}:${toBase64(ciphertext)}`
  } catch (e) {
    console.error("Encryption failed", e)
    return value
  }
}

async function decryptString(
  value: string | null | undefined,
): Promise<string | null> {
  if (!value) return null
  if (!value.startsWith("v1:")) return value // retro-compatibility for unencrypted records
  try {
    const parts = value.split(":")
    const nonce = fromBase64(parts[1])
    const ciphertext = fromBase64(parts[2])
    const key = await getEncryptionKey()
    const decrypted = await decryptData(ciphertext, nonce, key)
    return new TextDecoder().decode(decrypted)
  } catch (e) {
    console.error("Decryption failed", e)
    return value
  }
}

async function mapRowToTransaction(
  row: BridgeTransactionRow,
): Promise<BridgeTransaction> {
  return {
    id: row.id,
    userAddress: row.user_address ?? "",
    type: row.type,
    status: row.status,
    description: row.description,
    timestamp: row.timestamp,
    hash: row.hash ?? undefined,
    fromChain: (await decryptString(row.from_chain)) ?? undefined,
    toChain: (await decryptString(row.to_chain)) ?? undefined,
    amount: (await decryptString(row.amount)) ?? undefined,
    token: (await decryptString(row.token)) ?? undefined,
    lastUpdate: row.last_update ?? undefined,
    fromChainId: row.from_chain_id ?? undefined,
    toChainId: row.to_chain_id ?? undefined,
  }
}

export async function listBridgeTransactions(
  params: {
    limit?: number
    type?: "ALL" | "SWAP" | "SEND" | "RECEIVE" | "BRIDGE"
    address?: string
  } = { limit: 100 },
): Promise<BridgeTransaction[]> {
  let query = `
    SELECT
      id,
      user_address,
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
    WHERE 1=1
  `
  const args: any[] = []

  if (params.address) {
    query += ` AND user_address = ?`
    args.push(params.address)
  }

  if (params.type && params.type !== "ALL") {
    if (params.type === "SWAP") {
      query += ` AND type IN ('SWAP', 'BRIDGE')`
    } else {
      query += ` AND type = ?`
      args.push(params.type)
    }
  }

  query += ` ORDER BY timestamp DESC LIMIT ?`
  args.push(params.limit || 100)

  const rows = (await db.all(query, args)) as BridgeTransactionRow[]

  return Promise.all(rows.map(mapRowToTransaction))
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

  const encryptedFromChain = await encryptString(tx.fromChain)
  const encryptedToChain = await encryptString(tx.toChain)
  const encryptedAmount = await encryptString(tx.amount)
  const encryptedToken = await encryptString(tx.token)

  await db.run(
    `INSERT INTO bridge_transactions (
      id,
      user_address,
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      user_address = excluded.user_address,
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
      tx.userAddress || null,
      tx.type,
      tx.status,
      tx.description,
      tx.timestamp,
      tx.hash ?? null,
      encryptedFromChain ?? null,
      encryptedToChain ?? null,
      encryptedAmount ?? null,
      encryptedToken ?? null,
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
