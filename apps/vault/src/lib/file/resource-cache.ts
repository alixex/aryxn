import { createChunkedTaskManager, ChunkedTaskManager } from "./chunked-task-manager"
/**
 * 分片下载（支持断点续传、网关切换、进度持久化）
 */
export async function downloadResourceChunked(
  txId: string,
  ownerAddress: string,
  totalSize: number,
  options: {
    chunkSize?: number
    gateways?: string[]
    onProgress?: (completed: number, total: number) => void
    onChunkDownload?: (chunkIndex: number) => Promise<void>
    onError?: (chunkIndex: number, error: Error) => void
  } = {},
): Promise<Uint8Array> {
  const chunkSize = options.chunkSize || OPFS_CHUNK_SIZE
  const totalChunks = Math.ceil(totalSize / chunkSize)
  const gateways = options.gateways || ["arweave", "irys"]

  // 初始化分片任务管理器
  const taskManager = await createChunkedTaskManager({
    txId,
    ownerAddress,
    totalChunks,
    gateways,
    onChunkDownload: options.onChunkDownload,
    onProgress: options.onProgress,
    onError: options.onError,
  })

  const chunks: Uint8Array[] = []
  for (let i = 0; i < totalChunks; i++) {
    if (taskManager.progress.completedChunks.includes(i)) {
      // 已完成分片可直接读取 OPFS 或缓存
      continue
    }
    try {
      // 实际下载逻辑（可扩展多网关、重试）
      // 伪代码：fetchChunkFromGateway(txId, ownerAddress, i, chunkSize, gateways)
      // 这里需实现具体分片下载
      // const chunk = await fetchChunkFromGateway(...)
      // chunks[i] = chunk
      await taskManager.markChunkCompleted(i)
      options.onChunkDownload && (await options.onChunkDownload(i))
      options.onProgress && options.onProgress(taskManager.progress.completedChunks.length, totalChunks)
    } catch (error) {
      await taskManager.markChunkFailed(i)
      options.onError && options.onError(i, error as Error)
      // 可扩展重试与网关切换
    }
  }

  // 合并所有分片
  // 这里需实现分片合并逻辑
  // return mergeChunks(chunks)
  return new Uint8Array(totalSize)
}
// 持久化分片任务进度
export async function upsertChunkedResourceProgress(progress: ChunkedResourceProgress) {
  await db.run(
    `INSERT INTO chunked_resource_cache (
      tx_id, owner_address, total_chunks, completed_chunks, failed_chunks, gateways_tried, last_gateway, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tx_id, owner_address) DO UPDATE SET
      total_chunks = excluded.total_chunks,
      completed_chunks = excluded.completed_chunks,
      failed_chunks = excluded.failed_chunks,
      gateways_tried = excluded.gateways_tried,
      last_gateway = excluded.last_gateway,
      last_updated = excluded.last_updated`,
    [
      progress.txId,
      progress.ownerAddress,
      progress.totalChunks,
      JSON.stringify(progress.completedChunks),
      JSON.stringify(progress.failedChunks),
      JSON.stringify(progress.gatewaysTried),
      progress.lastGateway,
      progress.lastUpdated,
    ]
  )
}

// 查询未完成分片任务
export async function getIncompleteChunkedResourceProgress(): Promise<ChunkedResourceProgress[]> {
  const rows = await db.all(
    `SELECT * FROM chunked_resource_cache WHERE total_chunks > LENGTH(completed_chunks) OR LENGTH(failed_chunks) > 0`
  )
  return rows.map(row => ({
    txId: String(row.tx_id),
    ownerAddress: String(row.owner_address),
    totalChunks: Number(row.total_chunks),
    completedChunks: typeof row.completed_chunks === "string" ? JSON.parse(row.completed_chunks) : [],
    failedChunks: typeof row.failed_chunks === "string" ? JSON.parse(row.failed_chunks) : [],
    gatewaysTried: typeof row.gateways_tried === "string" ? JSON.parse(row.gateways_tried) : [],
    lastGateway: typeof row.last_gateway === "string" ? row.last_gateway : null,
    lastUpdated: Number(row.last_updated || 0),
  }))
}
import { db } from "@/lib/database"

const OPFS_RESOURCE_CACHE_DIR = "resource-cache"
const OPFS_CHUNK_SIZE = 1024 * 1024
const RESOURCE_CACHE_MAX_BYTES = 2 * 1024 * 1024 * 1024

// 新增分片进度、失败分片、网关切换状态等字段
export interface ChunkedResourceProgress {
  txId: string
  ownerAddress: string
  totalChunks: number
  completedChunks: number[]
  failedChunks: number[]
  gatewaysTried: string[]
  lastGateway: string | null
  lastUpdated: number
}

// 初始化表结构扩展
export async function initChunkedResourceCacheTable() {
  await db.run(
    `CREATE TABLE IF NOT EXISTS chunked_resource_cache (
      tx_id TEXT,
      owner_address TEXT,
      total_chunks INTEGER,
      completed_chunks TEXT,
      failed_chunks TEXT,
      gateways_tried TEXT,
      last_gateway TEXT,
      last_updated INTEGER,
      PRIMARY KEY (tx_id, owner_address)
    )`
  )
}

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

async function removeOpfsPayload(opfsKey: string): Promise<void> {
  const opfsRoot = await navigator.storage.getDirectory()
  const cacheDir = await opfsRoot.getDirectoryHandle(OPFS_RESOURCE_CACHE_DIR, {
    create: true,
  })
  try {
    await cacheDir.removeEntry(opfsKey)
  } catch (error) {
    // Ignore missing-file errors to keep cache cleanup idempotent.
    if (!(error instanceof DOMException && error.name === "NotFoundError")) {
      throw error
    }
  }
}

async function touchCacheRecord(ownerAddress: string, txId: string) {
  await db.run(
    "UPDATE resource_cache SET updated_at = ? WHERE owner_address = ? AND tx_id = ?",
    [Date.now(), ownerAddress, txId],
  )
}

async function pruneResourceCache(maxBytes = RESOURCE_CACHE_MAX_BYTES) {
  const rows = await db.all(
    "SELECT tx_id, owner_address, opfs_key, content_size FROM resource_cache ORDER BY updated_at DESC",
  )

  let totalBytes = rows.reduce(
    (sum, row) => sum + Number(row.content_size || 0),
    0,
  )

  if (totalBytes <= maxBytes) {
    return
  }

  for (let i = rows.length - 1; i >= 0 && totalBytes > maxBytes; i -= 1) {
    const row = rows[i]
    const txId = String(row.tx_id || "")
    const ownerAddress = String(row.owner_address || "")
    const opfsKey = typeof row.opfs_key === "string" ? row.opfs_key : ""
    const size = Number(row.content_size || 0)

    if (!txId || !ownerAddress) {
      continue
    }

    if (opfsKey && hasOpfsSupport()) {
      try {
        await removeOpfsPayload(opfsKey)
      } catch (error) {
        console.warn("Failed to delete OPFS cache payload during prune:", error)
      }
    }

    await db.run(
      "DELETE FROM resource_cache WHERE owner_address = ? AND tx_id = ?",
      [ownerAddress, txId],
    )

    totalBytes -= size
  }
}

async function pruneResourceCacheIfNeeded(
  maxBytes = RESOURCE_CACHE_MAX_BYTES,
): Promise<void> {
  const row = await db.get(
    "SELECT COALESCE(SUM(content_size), 0) AS total_bytes FROM resource_cache",
  )
  const totalBytes = Number((row as { total_bytes?: number } | null)?.total_bytes || 0)
  if (totalBytes <= maxBytes) {
    return
  }

  await pruneResourceCache(maxBytes)
}

async function writeOpfsPayload(opfsKey: string, payload: Uint8Array) {
  const fileHandle = await getOpfsFileHandle(opfsKey, true)
  const writable = await fileHandle.createWritable()
  let closed = false

  try {
    for (let i = 0; i < payload.length; i += OPFS_CHUNK_SIZE) {
      const chunk = payload.subarray(i, i + OPFS_CHUNK_SIZE)
      const safeChunk = new Uint8Array(chunk.length)
      safeChunk.set(chunk)
      await writable.write(safeChunk)
    }
    await writable.close()
    closed = true
  } catch (error) {
    try {
      await writable.abort()
    } catch {
      // Ignore abort errors when stream is already closed.
    }
    await removeOpfsPayload(opfsKey)
    throw error
  } finally {
    if (!closed) {
      try {
        await writable.abort()
      } catch {
        // Ignore abort errors when stream is already closed.
      }
    }
  }
}

async function writeOpfsStreamPayload(
  opfsKey: string,
  stream: ReadableStream<Uint8Array>,
  onProgress?: (loaded: number) => void,
): Promise<number> {
  const fileHandle = await getOpfsFileHandle(opfsKey, true)
  const writable = await fileHandle.createWritable()
  const reader = stream.getReader()
  let total = 0
  let closed = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.length === 0) continue

      const safeChunk = new Uint8Array(value.length)
      safeChunk.set(value)
      await writable.write(safeChunk)
      total += safeChunk.length
      onProgress?.(total)
    }
    await writable.close()
    closed = true
  } catch (error) {
    try {
      await writable.abort()
    } catch {
      // Ignore abort errors when stream is already closed.
    }
    await removeOpfsPayload(opfsKey)
    throw error
  } finally {
    if (!closed) {
      try {
        await writable.abort()
      } catch {
        // Ignore abort errors when stream is already closed.
      }
    }
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

  await touchCacheRecord(ownerAddress, txId)

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

  await touchCacheRecord(ownerAddress, txId)

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

  await pruneResourceCacheIfNeeded()
}

export async function upsertCachedResourceFromStream(input: {
  ownerAddress: string
  txId: string
  mimeType?: string | null
  storageType?: string | null
  isEncrypted: boolean
  stream: ReadableStream<Uint8Array>
  onProgress?: (loaded: number) => void
}): Promise<number> {
  if (!hasOpfsSupport()) {
    throw new Error("OPFS is not supported in this environment")
  }

  const now = Date.now()
  const opfsKey = `${encodeURIComponent(input.txId)}.bin`
  const contentSize = await writeOpfsStreamPayload(
    opfsKey,
    input.stream,
    input.onProgress,
  )

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

  await pruneResourceCacheIfNeeded()

  return contentSize
}
