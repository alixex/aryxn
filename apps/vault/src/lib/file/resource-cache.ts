import { db } from "@/lib/database"

export interface CachedResource {
  txId: string
  ownerAddress: string
  mimeType: string | null
  storageType: string | null
  isEncrypted: boolean
  payload: Uint8Array
  contentSize: number
}

function uint8ArrayToBase64(data: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function getCachedResource(
  ownerAddress: string,
  txId: string,
): Promise<CachedResource | null> {
  const row = await db.get(
    "SELECT * FROM resource_cache WHERE owner_address = ? AND tx_id = ? LIMIT 1",
    [ownerAddress, txId],
  )

  if (!row || typeof row.payload_base64 !== "string") {
    return null
  }

  return {
    txId: String(row.tx_id),
    ownerAddress: String(row.owner_address),
    mimeType: row.mime_type ? String(row.mime_type) : null,
    storageType: row.storage_type ? String(row.storage_type) : null,
    isEncrypted: Number(row.is_encrypted) === 1,
    payload: base64ToUint8Array(String(row.payload_base64)),
    contentSize: Number(row.content_size || 0),
  }
}

export async function upsertCachedResource(input: {
  ownerAddress: string
  txId: string
  mimeType?: string | null
  storageType?: string | null
  isEncrypted: boolean
  payload: Uint8Array
}): Promise<void> {
  const now = Date.now()
  const payloadBase64 = uint8ArrayToBase64(input.payload)

  await db.run(
    `INSERT INTO resource_cache (
      tx_id, owner_address, mime_type, storage_type, is_encrypted,
      payload_base64, content_size, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tx_id) DO UPDATE SET
      owner_address = excluded.owner_address,
      mime_type = excluded.mime_type,
      storage_type = excluded.storage_type,
      is_encrypted = excluded.is_encrypted,
      payload_base64 = excluded.payload_base64,
      content_size = excluded.content_size,
      updated_at = excluded.updated_at`,
    [
      input.txId,
      input.ownerAddress,
      input.mimeType || null,
      input.storageType || null,
      input.isEncrypted ? 1 : 0,
      payloadBase64,
      input.payload.length,
      now,
      now,
    ],
  )
}
