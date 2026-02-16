/**
 * 直接通过标签查询文件记录的同步工具函数
 * 不使用清单文件，直接从 Arweave 查询文件交易
 */

import { db } from "@/lib/database"
import { calculateFileHash } from "./file-manager"
import type { FileIndex } from "./file-manager"

interface ArweaveTransaction {
  id: string
  owner: {
    address: string
  }
  tags: Array<{
    name: string
    value: string
  }>
  block: {
    height: number
    timestamp: number
  }
  data: {
    size: string
  }
}

interface GraphQLQuery {
  query: string
  variables: {
    owner: string[]
    appName: string
    ownerAddress: string
    limit: number
    after?: string | null
  }
}

interface GraphQLResponse {
  data?: {
    transactions?: {
      pageInfo?: {
        hasNextPage: boolean
      }
      edges?: Array<{
        cursor: string
        node: ArweaveTransaction
      }>
    }
  }
  errors?: Array<{
    message: string
  }>
}

/**
 * 从 Arweave 查询所有文件交易（支持分页）
 * 自动处理分页，可以查询超过 10000 条的交易
 * @param ownerAddress 账户地址
 * @param limit 可选，限制返回的交易数量（如果不指定，查询所有）
 * @param onProgress 可选，进度回调函数 (current: number, total: number | null) => void
 */
export async function queryFileTransactions(
  ownerAddress: string,
  limit?: number,
  onProgress?: (current: number, total: number | null) => void,
): Promise<ArweaveTransaction[]> {
  const allTransactions: ArweaveTransaction[] = []
  let cursor: string | null = null
  const pageSize = 10000 // 每页最多 10000 条（Arweave API 限制）
  let pageCount = 0

  try {
    do {
      pageCount++
      // 构建 GraphQL 查询，动态处理可选的 after 参数
      const queryString = cursor
        ? `
        query GetFileTransactions($owner: [String!]!, $appName: String!, $ownerAddress: String!, $limit: Int!, $after: String) {
          transactions(
            owners: $owner
            tags: [
              { name: "App-Name", values: [$appName] }
              { name: "Owner-Address", values: [$ownerAddress] }
            ]
            sort: HEIGHT_DESC
            first: $limit
            after: $after
          ) {
              pageInfo {
                hasNextPage
              }
              edges {
                cursor
                node {
                  id
                  owner {
                    address
                  }
                  tags {
                    name
                    value
                  }
                  block {
                    height
                    timestamp
                  }
                  data {
                    size
                  }
                }
              }
            }
          }
        `
        : `
        query GetFileTransactions($owner: [String!]!, $appName: String!, $ownerAddress: String!, $limit: Int!) {
          transactions(
            owners: $owner
            tags: [
              { name: "App-Name", values: [$appName] }
              { name: "Owner-Address", values: [$ownerAddress] }
            ]
            sort: HEIGHT_DESC
            first: $limit
          ) {
              pageInfo {
                hasNextPage
              }
              edges {
                cursor
                node {
                  id
                  owner {
                    address
                  }
                  tags {
                    name
                    value
                  }
                  block {
                    height
                    timestamp
                  }
                  data {
                    size
                  }
                }
              }
            }
          }
        `

      const query: GraphQLQuery = {
        query: queryString,
        variables: {
          owner: [ownerAddress],
          appName: "Aryxn",
          ownerAddress: ownerAddress,
          limit: pageSize,
          ...(cursor && { after: cursor }),
        },
      }

      const response: Response = await fetch("https://arweave.net/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(query),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("GraphQL query failed:", response.status, errorText)
        throw new Error(
          `GraphQL query failed: ${response.status} - ${errorText}`,
        )
      }

      const result: GraphQLResponse = await response.json()

      if (result.errors) {
        console.error("GraphQL errors:", result.errors)
        throw new Error(`GraphQL query failed: ${result.errors[0]?.message}`)
      }

      const edges = result.data?.transactions?.edges || []
      const pageInfo = result.data?.transactions?.pageInfo

      // 添加当前页的交易
      const pageTransactions = edges.map(
        (edge: { node: ArweaveTransaction }) => edge.node,
      )
      allTransactions.push(...pageTransactions)

      // 更新进度回调
      if (onProgress) {
        onProgress(
          allTransactions.length,
          pageInfo?.hasNextPage ? null : allTransactions.length,
        )
      }

      console.log(
        `Page ${pageCount}: fetched ${pageTransactions.length} transactions (total: ${allTransactions.length})`,
      )

      // 检查是否还有下一页，从最后一个 edge 的 cursor 获取
      if (pageInfo?.hasNextPage && edges.length > 0) {
        const lastEdge = edges[edges.length - 1] as { cursor: string }
        cursor = lastEdge.cursor
        // 如果指定了 limit，检查是否已达到
        if (limit && allTransactions.length >= limit) {
          break
        }
      } else {
        cursor = null
      }
    } while (cursor)

    console.log(
      `Query completed: fetched ${allTransactions.length} transactions in ${pageCount} pages`,
    )

    // 如果指定了 limit，返回限制数量的结果
    if (limit && allTransactions.length > limit) {
      return allTransactions.slice(0, limit)
    }

    return allTransactions
  } catch (error) {
    console.error("Failed to query file transactions:", error)
    throw error
  }
}

/**
 * 从交易标签中提取文件信息
 */
function extractFileInfoFromTransaction(
  tx: ArweaveTransaction,
  ownerAddress: string,
): Partial<FileIndex> | null {
  try {
    const tags = tx.tags.reduce(
      (acc, tag) => {
        acc[tag.name] = tag.value
        return acc
      },
      {} as Record<string, string>,
    )

    // 验证必要的标签
    if (tags["App-Name"] !== "Aryxn") {
      return null
    }

    if (tags["Owner-Address"] !== ownerAddress) {
      return null
    }

    if (!tags["File-Name"]) {
      return null
    }

    // 提取文件信息
    const fileName = tags["File-Name"]
    const encryptionAlgo = tags["Encryption-Algo"] || "none"
    const encryptionParams = tags["Encryption-Params"] || "{}"
    // const compressionAlgo = tags["Compression-Algo"]
    // const compressionEnabled = tags["Compression-Enabled"] === "true"
    const mimeType = tags["Content-Type"] || "application/octet-stream"

    // 计算创建时间（从区块时间戳）
    const createdAt = tx.block?.timestamp
      ? tx.block.timestamp * 1000 // 转换为毫秒
      : Date.now()

    return {
      tx_id: tx.id,
      file_name: fileName,
      file_hash: "", // 将在同步时从文件内容计算
      file_size: parseInt(tx.data?.size || "0", 10),
      mime_type: mimeType,
      folder_id: null,
      description: null,
      owner_address: ownerAddress,
      storage_type: "arweave",
      encryption_algo: encryptionAlgo,
      encryption_params: encryptionParams,
      version: 1,
      previous_tx_id: null,
      created_at: createdAt,
      updated_at: createdAt,
    }
  } catch (error) {
    console.error("Failed to extract file info from transaction:", error)
    return null
  }
}

/**
 * 处理单个交易
 */
async function processTransaction(
  tx: ArweaveTransaction,
  ownerAddress: string,
): Promise<{
  added: number
  updated: number
  skipped: number
  errors: number
}> {
  const result = { added: 0, updated: 0, skipped: 0, errors: 0 }

  try {
    const fileInfo = extractFileInfoFromTransaction(tx, ownerAddress)

    if (!fileInfo || !fileInfo.tx_id) {
      result.errors = 1
      return result
    }

    // 检查文件是否已存在（通过 tx_id）
    const existing = await db.get(
      "SELECT id, updated_at, file_hash FROM file_indexes WHERE tx_id = ?",
      [fileInfo.tx_id],
    )

    // 检查是否需要下载文件来计算 hash
    // 只有在以下情况才需要下载：
    // 1. 文件不存在（新文件）
    // 2. 文件存在但 hash 是临时的（等于 tx_id，表示之前没有计算过真实 hash）
    const needsHashCalculation =
      !existing ||
      existing.file_hash === fileInfo.tx_id ||
      existing.file_hash === null ||
      existing.file_hash === ""

    // 只在必要时下载文件计算 hash，避免不必要的下载和磁盘占用
    let fileHash: string
    if (needsHashCalculation) {
      try {
        fileHash = await calculateFileHashFromArweave(fileInfo.tx_id ?? "")
      } catch (error) {
        console.error(
          `Failed to calculate hash for tx ${fileInfo.tx_id}:`,
          error,
        )
        result.errors = 1
        return result
      }
    } else {
      // 使用现有的 hash，避免重复下载
      fileHash = existing.file_hash as string
    }

    if (existing) {
      // 检查是否需要更新（包括检查 hash 是否需要更新）
      const existingUpdatedAt =
        typeof existing.updated_at === "number"
          ? existing.updated_at
          : Number(existing.updated_at)

      // 检查现有的 file_hash 是否是临时的（等于 tx_id）
      const needsHashUpdate =
        existing.file_hash === fileInfo.tx_id ||
        existing.file_hash === null ||
        existing.file_hash === ""

      if (
        fileInfo.updated_at &&
        (fileInfo.updated_at > existingUpdatedAt || needsHashUpdate)
      ) {
        // 更新现有记录（包括 file_hash）
        await db.run(
          `UPDATE file_indexes SET
            file_name = ?,
            file_hash = ?,
            file_size = ?,
            mime_type = ?,
            encryption_algo = ?,
            encryption_params = ?,
            updated_at = ?
          WHERE tx_id = ?`,
          [
            fileInfo.file_name ?? "",
            fileHash,
            fileInfo.file_size ?? 0,
            fileInfo.mime_type ?? "application/octet-stream",
            fileInfo.encryption_algo ?? "none",
            fileInfo.encryption_params ?? "{}",
            fileInfo.updated_at ?? Date.now(),
            fileInfo.tx_id ?? "",
          ],
        )
        result.updated = 1
      } else {
        result.skipped = 1
      }
    } else {
      // 插入新记录，使用 INSERT OR IGNORE 处理可能的竞态条件
      // 如果记录已经存在（由于并发插入），则忽略
      const fileId = crypto.randomUUID()

      try {
        await db.run(
          `INSERT OR IGNORE INTO file_indexes (
            id, tx_id, file_name, file_hash, file_size, mime_type,
            folder_id, description, owner_address, storage_type,
            encryption_algo, encryption_params, version, previous_tx_id,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            fileId,
            fileInfo.tx_id ?? "",
            fileInfo.file_name ?? "",
            fileHash, // 使用真实的文件 hash
            fileInfo.file_size ?? 0,
            fileInfo.mime_type ?? "application/octet-stream",
            fileInfo.folder_id ?? null,
            fileInfo.description ?? null,
            ownerAddress,
            fileInfo.storage_type ?? "arweave",
            fileInfo.encryption_algo ?? "none",
            fileInfo.encryption_params ?? "{}",
            fileInfo.version ?? 1,
            fileInfo.previous_tx_id ?? null,
            fileInfo.created_at ?? Date.now(),
            fileInfo.updated_at ?? Date.now(),
          ],
        )

        // 检查是否实际插入了记录（INSERT OR IGNORE 可能因为唯一约束而没有插入）
        const insertedRecord = await db.get(
          "SELECT rowid, id FROM file_indexes WHERE tx_id = ?",
          [fileInfo.tx_id],
        )

        if (insertedRecord) {
          // 更新全文搜索索引（使用 INSERT OR IGNORE 避免重复）
          await db.run(
            `INSERT OR IGNORE INTO file_indexes_fts (rowid, file_name, description)
             VALUES (?, ?, ?)`,
            [
              insertedRecord.rowid,
              fileInfo.file_name ?? "",
              fileInfo.description ?? "",
            ],
          )
          result.added = 1
        } else {
          // 记录已存在（可能是并发插入），标记为跳过
          result.skipped = 1
        }
      } catch (insertError: unknown) {
        // 如果插入失败（例如唯一约束冲突），检查记录是否已存在
        const checkExisting = await db.get(
          "SELECT id FROM file_indexes WHERE tx_id = ?",
          [fileInfo.tx_id],
        )
        if (checkExisting) {
          // 记录已存在，标记为跳过
          result.skipped = 1
        } else {
          // 其他错误，记录为错误
          console.error(
            `Failed to insert transaction ${fileInfo.tx_id}:`,
            insertError,
          )
          result.errors = 1
        }
      }
    }
  } catch (error) {
    console.error(`Failed to process transaction ${tx.id}:`, error)
    result.errors = 1
  }

  return result
}

/**
 * requestIdleCallback 的 polyfill（如果不支持则使用 setTimeout）
 */
function requestIdleCallbackPolyfill(
  callback: (deadline: {
    timeRemaining: () => number
    didTimeout: boolean
  }) => void,
  options?: { timeout?: number },
): number {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    return window.requestIdleCallback(callback, options)
  }
  // 降级到 setTimeout，模拟空闲时间
  const start = Date.now()
  const timeout = options?.timeout ?? 5000
  return setTimeout(() => {
    callback({
      timeRemaining: () => Math.max(0, timeout - (Date.now() - start)),
      didTimeout: false,
    })
  }, 1) as unknown as number
}

/**
 * 在浏览器空闲时间自动同步文件记录
 * 避免阻塞页面渲染和交互
 */
export function scheduleAutoSync(
  ownerAddress: string,
  onComplete?: (result: {
    added: number
    updated: number
    skipped: number
    errors: number
  }) => void,
): void {
  if (typeof window === "undefined") {
    return
  }

  requestIdleCallbackPolyfill(
    async () => {
      try {
        console.log("[scheduleAutoSync] Starting automatic sync in idle time")
        const result = await syncFilesFromArweaveDirect(ownerAddress)
        console.log(
          `[scheduleAutoSync] Sync completed: added ${result.added}, updated ${result.updated}, skipped ${result.skipped}, errors ${result.errors}`,
        )
        if (onComplete) {
          onComplete(result)
        }
      } catch (error) {
        console.warn("[scheduleAutoSync] Failed to sync files:", error)
      }
    },
    { timeout: 10000 }, // 10 秒超时
  )
}

/**
 * 同步文件记录到本地数据库（通过直接查询 Arweave）
 * 使用 requestIdleCallback 在浏览器空闲时间执行，避免阻塞主流程
 */
export async function syncFilesFromArweaveDirect(
  ownerAddress: string,
  onProgress?: (current: number, total: number | null) => void,
): Promise<{
  added: number
  updated: number
  skipped: number
  errors: number
}> {
  const stats = { added: 0, updated: 0, skipped: 0, errors: 0 }

  try {
    // 查询所有文件交易（支持分页，可以查询超过 10000 条）
    // 使用进度回调来报告查询进度
    const transactions = await queryFileTransactions(
      ownerAddress,
      undefined, // 不限制数量，查询所有文件
      onProgress,
    )

    console.log(`Found ${transactions.length} file transactions`)

    if (transactions.length === 0) {
      return stats
    }

    // 分批处理，每批处理少量文件
    const BATCH_SIZE = 3
    const MAX_TIME_PER_BATCH = 50

    const pendingTransactions = [...transactions]

    // 使用 Promise 来等待所有批次完成
    return new Promise((resolve) => {
      const processBatch = async (deadline: {
        timeRemaining: () => number
        didTimeout: boolean
      }) => {
        const startTime = Date.now()
        let processedInBatch = 0

        // 在空闲时间内处理批次
        while (
          pendingTransactions.length > 0 &&
          processedInBatch < BATCH_SIZE &&
          (deadline.timeRemaining() > 0 || deadline.didTimeout) &&
          Date.now() - startTime < MAX_TIME_PER_BATCH
        ) {
          const tx = pendingTransactions.shift()
          if (!tx) break

          const result = await processTransaction(tx, ownerAddress)
          stats.added += result.added
          stats.updated += result.updated
          stats.skipped += result.skipped
          stats.errors += result.errors
          processedInBatch++
        }

        // 如果还有待处理的交易，继续调度下一批
        if (pendingTransactions.length > 0) {
          requestIdleCallbackPolyfill(processBatch, {
            timeout: 5000,
          })
        } else {
          // 所有交易处理完成
          resolve(stats)
        }
      }

      // 开始处理第一批
      requestIdleCallbackPolyfill(processBatch, {
        timeout: 5000,
      })
    })
  } catch (error) {
    console.error("Failed to sync files:", error)
    throw error
  }
}

/**
 * 计算文件哈希（从 Arweave 下载文件内容）
 * 注意：这会增加成本，只在必要时使用
 */
export async function calculateFileHashFromArweave(
  txId: string,
): Promise<string> {
  try {
    // 使用 no-store 缓存策略，避免浏览器缓存文件到磁盘
    // 因为我们只需要计算 hash，不需要保存文件
    const response = await fetch(`https://arweave.net/${txId}`, {
      cache: "no-store",
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`)
    }

    const buffer = await response.arrayBuffer()
    const file = new File([buffer], "temp")
    const hash = await calculateFileHash(file)

    // 立即释放内存，帮助垃圾回收
    // 注意：File 和 ArrayBuffer 会在函数返回后自动被垃圾回收
    // 这里只是显式地提醒我们不需要保留这些数据

    return hash
  } catch (error) {
    console.error("Failed to calculate file hash:", error)
    throw error
  }
}
