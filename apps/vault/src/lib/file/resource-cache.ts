import { db } from "@/lib/database"

const OPFS_RESOURCE_CACHE_DIR = "resource-cache"
const OPFS_CHUNK_SIZE = 1024 * 1024

export interface CachedResource {
  txId: string
  ownerAddress: string
  mimeType: string | null
  storageType: string | null
  isEncrypted: boolean
  payload: Uint8Array
  contentSize: number
  backend: "opfs"
}

function hasOpfsSupport(): boolean {
  return !!(
    typeof navigator !== "undefined" &&
    navigator.storage &&
    typeof navigator.storage.getDirectory === "function"
  )
}

async function getOpfsFileHandle(
  opfsKey: string,
  create: boolean,
): Promise<FileSystemFileHandle> {
  const opfsRoot = await navigator.storage.getDirectory()
  const cacheDir = await opfsRoot.getDirectoryHandle(OPFS_RESOURCE_CACHE_DIR, {
    create,
  })
  return cacheDir.getFileHandle(opfsKey, { create })
}

async function writeOpfsPayload(opfsKey: string, payload: Uint8Array) {
  const fileHandle = await getOpfsFileHandle(opfsKey, true)
  const writable = await fileHandle.createWritable()

  try {
    for (let i = 0; i < payload.length; i += OPFS_CHUNK_SIZE) {
      const chunk = payload.subarray(i, i + OPFS_CHUNK_SIZE)
      const safeChunk = new Uint8Array(chunk.length)
      safeChunk.set(chunk)
      await writable.write(safeChunk)
    }
  } finally {
    await writable.close()
  }
}

async function writeOpfsStreamPayload(
  opfsKey: string,
  stream: ReadableStream<Uint8Array>,
): Promise<number> {
  const fileHandle = await getOpfsFileHandle(opfsKey, true)
  const writable = await fileHandle.createWritable()
  const reader = stream.getReader()
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.length === 0) continue

      const safeChunk = new Uint8Array(value.length)
      safeChunk.set(value)
      await writable.write(safeChunk)
      total += safeChunk.length
    }
  } finally {
    await writable.close()
  }

  return total
}

async function readOpfsPayload(opfsKey: string): Promise<Uint8Array> {
  const fileHandle = await getOpfsFileHandle(opfsKey, false)
  const file = await fileHandle.getFile()
  return new Uint8Array(await file.arrayBuffer())
}

async function readOpfsFile(opfsKey: string): Promise<File> {
  const fileHandle = await getOpfsFileHandle(opfsKey, false)
  return fileHandle.getFile()
}

export async function getCachedResource(
  ownerAddress: string,
  txId: string,
): Promise<CachedResource | null> {
  if (!hasOpfsSupport()) {
    return null
  }

  const row = await db.get(
    "SELECT * FROM resource_cache WHERE owner_address = ? AND tx_id = ? LIMIT 1",
    [ownerAddress, txId],
  )

  if (!row || typeof row.opfs_key !== "string" || !row.opfs_key) {
    return null
  }

  return {
    txId: String(row.tx_id),
    ownerAddress: String(row.owner_address),
    mimeType: row.mime_type ? String(row.mime_type) : null,
    storageType: row.storage_type ? String(row.storage_type) : null,
    isEncrypted: Number(row.is_encrypted) === 1,
    payload: await readOpfsPayload(String(row.opfs_key)),
    contentSize: Number(row.content_size || 0),
    backend: "opfs",
  }
}

export async function getCachedResourceFile(
  ownerAddress: string,
  txId: string,
): Promise<File | null> {
  if (!hasOpfsSupport()) {
    return null
  }

  const row = await db.get(
    "SELECT opfs_key FROM resource_cache WHERE owner_address = ? AND tx_id = ? LIMIT 1",
    [ownerAddress, txId],
  )

  if (!row || typeof row.opfs_key !== "string" || !row.opfs_key) {
    return null
  }

  return readOpfsFile(String(row.opfs_key))
}

export async function upsertCachedResource(input: {
  ownerAddress: string
  txId: string
  mimeType?: string | null
  storageType?: string | null
  isEncrypted: boolean
  payload: Uint8Array
}): Promise<void> {
  if (!hasOpfsSupport()) {
    return
  }

  const now = Date.now()
  const opfsKey = `${encodeURIComponent(input.txId)}.bin`
  await writeOpfsPayload(opfsKey, input.payload)

  await db.run(
    `INSERT INTO resource_cache (
      tx_id, owner_address, mime_type, storage_type, is_encrypted,
      cache_backend, opfs_key, payload_base64, content_size, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tx_id) DO UPDATE SET
      owner_address = excluded.owner_address,
      mime_type = excluded.mime_type,
      storage_type = excluded.storage_type,
      is_encrypted = excluded.is_encrypted,
      cache_backend = excluded.cache_backend,
      opfs_key = excluded.opfs_key,
      payload_base64 = excluded.payload_base64,
      content_size = excluded.content_size,
      updated_at = excluded.updated_at`,
    [
      input.txId,
      input.ownerAddress,
      input.mimeType || null,
      input.storageType || null,
      input.isEncrypted ? 1 : 0,
      "opfs",
      opfsKey,
      "",
      input.payload.length,
      now,
      now,
    ],
  )
}

export async function upsertCachedResourceFromStream(input: {
  ownerAddress: string
  txId: string
  mimeType?: string | null
  storageType?: string | null
  isEncrypted: boolean
  stream: ReadableStream<Uint8Array>
}): Promise<number> {
  if (!hasOpfsSupport()) {
    throw new Error("OPFS is not supported in this environment")
  }

  const now = Date.now()
  const opfsKey = `${encodeURIComponent(input.txId)}.bin`
  const contentSize = await writeOpfsStreamPayload(opfsKey, input.stream)

  await db.run(
    `INSERT INTO resource_cache (
      tx_id, owner_address, mime_type, storage_type, is_encrypted,
      cache_backend, opfs_key, payload_base64, content_size, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tx_id) DO UPDATE SET
      owner_address = excluded.owner_address,
      mime_type = excluded.mime_type,
      storage_type = excluded.storage_type,
      is_encrypted = excluded.is_encrypted,
      cache_backend = excluded.cache_backend,
      opfs_key = excluded.opfs_key,
      payload_base64 = excluded.payload_base64,
      content_size = excluded.content_size,
      updated_at = excluded.updated_at`,
    [
      input.txId,
      input.ownerAddress,
      input.mimeType || null,
      input.storageType || null,
      input.isEncrypted ? 1 : 0,
      "opfs",
      opfsKey,
      "",
      contentSize,
      now,
      now,
    ],
  )

  return contentSize
}
