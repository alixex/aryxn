import { db } from "@/lib/database"
import type { PaymentIntent, PaymentStatus } from "./types"
import { type DbRow } from "@aryxn/storage"

type PaymentIntentRow = DbRow & {
  id: string
  tx_hash: string | null
  from_chain: string
  from_token: string
  to_token: string
  ar_address: string
  file_metadata: string | null
  status: PaymentStatus
  payment_type: string
  target_balance_type: string | null
  created_at: number
  updated_at: number
}

function mapRowToIntent(row: PaymentIntentRow): PaymentIntent {
  return {
    id: row.id,
    txHash: row.tx_hash ?? undefined,
    fromChain: row.from_chain,
    fromToken: row.from_token,
    toToken: row.to_token,
    arAddress: row.ar_address,
    fileMetadata: row.file_metadata ? JSON.parse(row.file_metadata) : undefined,
    status: row.status,
    paymentType: row.payment_type as any, // fallback to any if no explicit type
    targetBalanceType:
      (row.target_balance_type as import("./types").TargetBalanceType) ||
      undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const PaymentRepository = {
  /**
   * Create a new payment intent record
   */
  async createIntent(
    intent: Omit<PaymentIntent, "id" | "createdAt" | "updatedAt">,
  ): Promise<PaymentIntent> {
    const id = crypto.randomUUID()
    const now = Date.now()
    const newIntent: PaymentIntent = {
      ...intent,
      id,
      createdAt: now,
      updatedAt: now,
    }

    await db.run(
      `INSERT INTO upload_payment_intents (
        id, tx_hash, from_chain, from_token, to_token, ar_address, 
        file_metadata, status, payment_type, target_balance_type, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        newIntent.txHash ?? null,
        newIntent.fromChain,
        newIntent.fromToken,
        newIntent.toToken,
        newIntent.arAddress,
        newIntent.fileMetadata ? JSON.stringify(newIntent.fileMetadata) : null,
        newIntent.status,
        newIntent.paymentType,
        newIntent.targetBalanceType ?? null,
        now,
        now,
      ],
    )

    return newIntent
  },

  /**
   * Update an existing payment intent
   */
  async updateIntent(
    id: string,
    updates: Partial<PaymentIntent>,
  ): Promise<void> {
    const now = Date.now()
    const fields: string[] = ["updated_at = ?"]
    const values: any[] = [now]

    if (updates.txHash !== undefined) {
      fields.push("tx_hash = ?")
      values.push(updates.txHash ?? null)
    }
    if (updates.status !== undefined) {
      fields.push("status = ?")
      values.push(updates.status)
    }
    if (updates.fileMetadata !== undefined) {
      fields.push("file_metadata = ?")
      values.push(
        updates.fileMetadata ? JSON.stringify(updates.fileMetadata) : null,
      )
    }
    if (updates.targetBalanceType !== undefined) {
      fields.push("target_balance_type = ?")
      values.push(updates.targetBalanceType ?? null)
    }

    if (fields.length === 1) return // Only updated_at

    values.push(id)
    await db.run(
      `UPDATE upload_payment_intents SET ${fields.join(", ")} WHERE id = ?`,
      values,
    )
  },

  /**
   * Get a specific intent by ID
   */
  async getIntent(id: string): Promise<PaymentIntent | null> {
    const row = (await db.get(
      "SELECT * FROM upload_payment_intents WHERE id = ?",
      [id],
    )) as PaymentIntentRow | null
    return row ? mapRowToIntent(row) : null
  },

  /**
   * Fetch all active/pending intents within the last 24 hours
   */
  async getActiveIntents(): Promise<PaymentIntent[]> {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    const rows = (await db.all(
      "SELECT * FROM upload_payment_intents WHERE status IN ('INITIATED', 'PENDING') AND updated_at > ? ORDER BY updated_at DESC",
      [cutoff],
    )) as PaymentIntentRow[]
    return rows.map(mapRowToIntent)
  },

  /**
   * Mark an intent as completed, failed, or expired
   */
  async setStatus(id: string, status: PaymentStatus): Promise<void> {
    await this.updateIntent(id, { status })
  },

  /**
   * Delete an intent (cleanup)
   */
  async deleteIntent(id: string): Promise<void> {
    await db.run("DELETE FROM upload_payment_intents WHERE id = ?", [id])
  },
}
