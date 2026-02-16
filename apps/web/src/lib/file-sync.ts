/**
 * 文件记录同步到 Arweave 的工具函数
 * 用于在不同设备间同步文件记录
 */

import { arweave } from "./storage"
import { db } from "./sqlite-db"
import { searchFiles } from "./file-manager"
import type { WalletKey, ArweaveJWK } from "./types"

/**
 * requestIdleCallback 的 polyfill（如果不支持则使用 setTimeout）
 * 用于在浏览器空闲时间执行任务，避免阻塞页面渲染和交互
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

export interface FileManifest {
  version: string
  ownerAddress: string
  lastUpdated: number
  /** 上一个清单文件的交易 ID（用于版本链） */
  previousManifestTxId?: string | null
  files: Array<{
    id: string
    tx_id: string
    file_name: string
    file_hash: string
    file_size: number
    mime_type: string
    folder_id: string | null
    description: string | null
    storage_type: string
    encryption_algo: string
    encryption_params: string
    version: number
    previous_tx_id: string | null
    created_at: number
    updated_at: number
    tags?: string[]
  }>
}

/**
 * 增量清单文件（只包含新增/更新的文件）
 * 首次上传时 previousManifestTxId 为 null
 */
export interface IncrementalManifest {
  version: string
  ownerAddress: string
  lastUpdated: number
  /** 上一个清单文件的交易 ID（首次上传时为 null） */
  previousManifestTxId: string | null
  /** 新增的文件 */
  added: Array<{
    id: string
    tx_id: string
    file_name: string
    file_hash: string
    file_size: number
    mime_type: string
    folder_id: string | null
    description: string | null
    storage_type: string
    encryption_algo: string
    encryption_params: string
    version: number
    previous_tx_id: string | null
    created_at: number
    updated_at: number
    tags?: string[]
  }>
  /** 更新的文件 */
  updated?: Array<{
    id: string
    tx_id: string
    file_name: string
    file_hash: string
    file_size: number
    mime_type: string
    folder_id: string | null
    description: string | null
    storage_type: string
    encryption_algo: string
    encryption_params: string
    version: number
    previous_tx_id: string | null
    created_at: number
    updated_at: number
    tags?: string[]
  }>
  /** 删除的文件 ID（通过 tx_id） */
  deleted?: string[]
}

const MANIFEST_VERSION = "1.0.0" // 合并后的完整清单版本
const MANIFEST_APP_NAME = "Aryxn-Manifest"
const INCREMENTAL_MANIFEST_VERSION = "1.1.0" // 增量清单版本（统一方案）

/**
 * 估算清单文件的大小（字节）
 */
export async function estimateManifestSize(
  ownerAddress: string,
  includeNewFile?: {
    id: string
    tx_id: string
    file_name: string
    file_hash: string
    file_size: number
    mime_type: string
    folder_id: string | null
    description: string | null
    storage_type: string
    encryption_algo: string
    encryption_params: string
    version: number
    previous_tx_id: string | null
    created_at: number
    updated_at: number
    tags?: string[]
  },
): Promise<number> {
  // 获取所有文件记录
  const files = await searchFiles(ownerAddress, { limit: 10000 })

  // 构建清单对象（包含新文件）
  const manifestFiles = files.map((file) => ({
    id: file.id,
    tx_id: file.tx_id,
    file_name: file.file_name,
    file_hash: file.file_hash,
    file_size: file.file_size,
    mime_type: file.mime_type,
    folder_id: file.folder_id,
    description: file.description,
    storage_type: file.storage_type,
    encryption_algo: file.encryption_algo,
    encryption_params: file.encryption_params,
    version: file.version,
    previous_tx_id: file.previous_tx_id,
    created_at: file.created_at,
    updated_at: file.updated_at,
    tags: file.tags || [],
  }))

  // 如果提供了新文件，添加到列表中
  if (includeNewFile) {
    manifestFiles.push({
      ...includeNewFile,
      tags: includeNewFile.tags || [],
    })
  }

  const manifest: FileManifest = {
    version: MANIFEST_VERSION,
    ownerAddress,
    lastUpdated: Date.now(),
    files: manifestFiles,
  }

  // 将清单转换为 JSON 字符串并计算大小
  const manifestJson = JSON.stringify(manifest)
  return new Blob([manifestJson], { type: "application/json" }).size
}

/**
 * 获取最新的清单文件交易 ID
 */
async function getLatestManifestTxId(
  ownerAddress: string,
): Promise<string | null> {
  try {
    const query = {
      query: `
        query GetLatestManifest($owner: [String!]!, $appName: String!, $ownerAddress: String!) {
          transactions(
            owners: $owner
            tags: [
              { name: "App-Name", values: [$appName] }
              { name: "Owner-Address", values: [$ownerAddress] }
            ]
            sort: HEIGHT_DESC
            first: 1
          ) {
            edges {
              node {
                id
                owner {
                  address
                }
                tags {
                  name
                  value
                }
              }
            }
          }
        }
      `,
      variables: {
        owner: [ownerAddress],
        appName: MANIFEST_APP_NAME,
        ownerAddress: ownerAddress,
      },
    }

    const response = await fetch("https://arweave.net/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(query),
    })

    if (!response.ok) {
      return null
    }

    const result = await response.json()
    const transactions = result.data?.transactions?.edges

    if (!transactions || transactions.length === 0) {
      return null
    }

    const transaction = transactions[0].node

    // 验证返回的交易确实是由该地址发起的（双重验证）
    if (transaction.owner.address !== ownerAddress) {
      console.error(
        `Manifest transaction owner mismatch: expected ${ownerAddress}, got ${transaction.owner.address}`,
      )
      return null
    }

    // 验证 App-Name 标签（双重验证）
    const appNameTag = transaction.tags.find(
      (tag: { name: string; value: string }) => tag.name === "App-Name",
    )
    if (!appNameTag || appNameTag.value !== MANIFEST_APP_NAME) {
      console.error(
        `Manifest transaction App-Name mismatch: expected ${MANIFEST_APP_NAME}, got ${appNameTag?.value}`,
      )
      return null
    }

    // 验证 Owner-Address 标签（双重验证）
    const ownerAddressTag = transaction.tags.find(
      (tag: { name: string; value: string }) => tag.name === "Owner-Address",
    )
    if (!ownerAddressTag || ownerAddressTag.value !== ownerAddress) {
      console.error(
        `Manifest transaction Owner-Address tag mismatch: expected ${ownerAddress}, got ${ownerAddressTag?.value}`,
      )
      return null
    }

    return transaction.id
  } catch (error) {
    console.error("Failed to get latest manifest txId:", error)
    return null
  }
}

/**
 * 上传增量清单文件到 Arweave（推荐）
 * 只包含新增的文件，大幅减少清单文件大小
 */
export async function uploadIncrementalManifest(
  ownerAddress: string,
  key: WalletKey,
  useExternalWallet?: boolean,
): Promise<string> {
  // 获取最新的清单交易 ID
  const previousManifestTxId = await getLatestManifestTxId(ownerAddress)

  // 获取所有当前文件记录
  const allFiles = await searchFiles(ownerAddress, { limit: 10000 })

  // 构建已有文件的 tx_id 集合
  let existingTxIds: Set<string> = new Set()

  // 如果有之前的清单，需要获取已有文件列表
  if (previousManifestTxId) {
    // 下载之前的清单，获取已有文件列表
    const previousManifest = await downloadManifestByTxId(previousManifestTxId)
    if (previousManifest) {
      // 增量清单，需要合并成完整清单以获取所有文件
      const mergedManifest = await mergeManifestChain(previousManifestTxId)
      if (mergedManifest) {
        existingTxIds = new Set(
          mergedManifest.files.map((f: { tx_id: string }) => f.tx_id),
        )
      }
    }
  }

  // 找出新增的文件
  const addedFiles = allFiles
    .filter((file) => !existingTxIds.has(file.tx_id))
    .map((file) => ({
      id: file.id,
      tx_id: file.tx_id,
      file_name: file.file_name,
      file_hash: file.file_hash,
      file_size: file.file_size,
      mime_type: file.mime_type,
      folder_id: file.folder_id,
      description: file.description,
      storage_type: file.storage_type,
      encryption_algo: file.encryption_algo,
      encryption_params: file.encryption_params,
      version: file.version,
      previous_tx_id: file.previous_tx_id,
      created_at: file.created_at,
      updated_at: file.updated_at,
      tags: file.tags || [],
    }))

  // 如果没有新增文件，不需要更新清单
  if (addedFiles.length === 0) {
    console.log("No new files, skipping manifest update")
    if (previousManifestTxId) {
      return previousManifestTxId
    }
    // 首次上传但没有文件，不应该发生，但为了安全返回 null
    throw new Error("No files to upload and no previous manifest")
  }

  // 构建增量清单（首次上传时 previousManifestTxId 为 null）
  const incrementalManifest: IncrementalManifest = {
    version: INCREMENTAL_MANIFEST_VERSION,
    ownerAddress,
    lastUpdated: Date.now(),
    previousManifestTxId: previousManifestTxId || null,
    added: addedFiles,
  }

  // 将增量清单转换为 JSON 字符串
  const manifestJson = JSON.stringify(incrementalManifest)
  const manifestBlob = new Blob([manifestJson], { type: "application/json" })
  const manifestFile = new File([manifestBlob], "incremental-manifest.json", {
    type: "application/json",
  })

  // 上传增量清单文件到 Arweave
  const txId = await uploadManifestFile(
    manifestFile,
    key,
    ownerAddress,
    addedFiles.length, // 只包含新增文件数量
    useExternalWallet,
    previousManifestTxId || undefined, // 传递上一个清单的交易 ID（可能为 undefined）
  )

  console.log(
    `[uploadIncrementalManifest] Uploaded incremental manifest: ${txId} (${addedFiles.length} new files${previousManifestTxId ? "" : ", first manifest"})`,
  )

  return txId
}

/**
 * 下载指定交易 ID 的清单文件
 * 只支持增量清单格式
 */
export async function downloadManifestByTxId(
  txId: string,
): Promise<IncrementalManifest | null> {
  try {
    const manifestResponse = await fetch(`https://arweave.net/${txId}`)
    if (!manifestResponse.ok) {
      throw new Error(`Failed to fetch manifest: ${manifestResponse.status}`)
    }

    const manifestJson = await manifestResponse.text()
    const manifest = JSON.parse(manifestJson)

    // 只支持增量清单格式
    if (
      manifest.version === INCREMENTAL_MANIFEST_VERSION &&
      "added" in manifest
    ) {
      return manifest as IncrementalManifest
    }

    // 如果不是增量清单格式，返回 null
    console.error(
      `Manifest ${txId} is not in incremental format (version: ${manifest.version})`,
    )
    return null
  } catch (error) {
    console.error(`Failed to download manifest ${txId}:`, error)
    return null
  }
}

/**
 * 合并增量清单链，生成完整清单
 * 沿着版本链向上遍历，合并所有增量清单
 */
export async function mergeManifestChain(
  latestTxId: string,
): Promise<FileManifest | null> {
  const files = new Map<string, FileManifest["files"][0]>()
  let currentTxId: string | null = latestTxId
  const visitedTxIds = new Set<string>()
  let ownerAddress: string | null = null
  const maxDepth = 1000 // 防止无限循环
  let depth = 0

  // 沿着版本链向上遍历
  while (currentTxId && !visitedTxIds.has(currentTxId) && depth < maxDepth) {
    visitedTxIds.add(currentTxId)
    depth++

    const manifest = await downloadManifestByTxId(currentTxId)
    if (!manifest) {
      console.warn(
        `Failed to download manifest ${currentTxId}, stopping chain merge`,
      )
      break
    }

    // 保存 ownerAddress（从第一个清单获取）
    if (!ownerAddress) {
      ownerAddress = manifest.ownerAddress
    }

    // 处理增量清单
    const incremental = manifest as IncrementalManifest

    // 添加新增的文件（后添加的覆盖先添加的）
    incremental.added.forEach((file) => {
      files.set(file.tx_id, file)
    })

    // 处理更新的文件
    if (incremental.updated) {
      incremental.updated.forEach((file) => {
        files.set(file.tx_id, file)
      })
    }

    // 处理删除的文件
    if (incremental.deleted) {
      incremental.deleted.forEach((txId) => {
        files.delete(txId)
      })
    }

    // 继续向上遍历
    currentTxId = incremental.previousManifestTxId
  }

  if (depth >= maxDepth) {
    console.error("Manifest chain too deep, possible circular reference")
    return null
  }

  if (!ownerAddress) {
    console.error("Failed to determine owner address from manifest chain")
    return null
  }

  // 构建完整清单
  return {
    version: MANIFEST_VERSION,
    ownerAddress,
    lastUpdated: Date.now(),
    previousManifestTxId: null, // 合并后的完整清单不需要 previousManifestTxId
    files: Array.from(files.values()),
  }
}

/**
 * 上传清单文件（带特殊标签）
 */
async function uploadManifestFile(
  file: File,
  key: WalletKey,
  ownerAddress: string,
  fileCount: number,
  useExternalWallet?: boolean,
  previousManifestTxId?: string,
): Promise<string> {
  const reader = new FileReader()
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer)

        // 如果使用外部钱包，需要先获取地址，然后创建临时 key 用于创建交易
        let transactionKey: ArweaveJWK | string | "use_wallet" =
          key || "use_wallet"

        if (useExternalWallet && window.arweaveWallet) {
          await window.arweaveWallet.getActiveAddress()
          // 创建一个临时 key 用于创建交易（不会用于签名）
          const tempKey = await arweave.wallets.generate()
          transactionKey = tempKey as unknown as ArweaveJWK
        } else if (!key) {
          throw new Error("Key is required when not using external wallet")
        }

        const transaction = await arweave.createTransaction(
          { data },
          typeof transactionKey === "string" && transactionKey !== "use_wallet"
            ? (JSON.parse(transactionKey) as ArweaveJWK)
            : transactionKey,
        )

        // 添加特殊标签用于识别清单文件
        transaction.addTag("Content-Type", "application/json")
        transaction.addTag("App-Name", MANIFEST_APP_NAME)
        transaction.addTag("Owner-Address", ownerAddress)
        transaction.addTag("Manifest-Version", MANIFEST_VERSION)
        transaction.addTag("File-Count", fileCount.toString())

        // 如果提供了上一个清单的交易 ID，添加到标签中
        if (previousManifestTxId) {
          transaction.addTag("Previous-Manifest-TxId", previousManifestTxId)
        }

        // 如果使用外部钱包（ArConnect），使用钱包签名
        if (useExternalWallet && window.arweaveWallet) {
          await window.arweaveWallet.sign(transaction)
        } else {
          if (!key) {
            throw new Error("Key is required when not using external wallet")
          }
          const signKey =
            typeof key === "string" ? (JSON.parse(key) as ArweaveJWK) : key
          await arweave.transactions.sign(transaction, signKey)
        }

        const response = await arweave.transactions.post(transaction)

        if (response.status === 200) {
          resolve(transaction.id)
        } else {
          reject(new Error(`Manifest upload failed: ${response.status}`))
        }
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 从 Arweave 查询并下载最新的清单文件
 * 自动合并版本链生成完整清单
 */
export async function downloadManifest(
  ownerAddress: string,
): Promise<FileManifest | null> {
  try {
    // 查询该地址的所有清单文件交易
    // 使用 Arweave GraphQL API
    const query = {
      query: `
        query GetManifests($owner: [String!]!, $appName: String!, $ownerAddress: String!) {
          transactions(
            owners: $owner
            tags: [
              { name: "App-Name", values: [$appName] }
              { name: "Owner-Address", values: [$ownerAddress] }
            ]
            sort: HEIGHT_DESC
            first: 1
          ) {
            edges {
              node {
                id
                owner {
                  address
                }
                tags {
                  name
                  value
                }
              }
            }
          }
        }
      `,
      variables: {
        owner: [ownerAddress],
        appName: MANIFEST_APP_NAME,
        ownerAddress: ownerAddress,
      },
    }

    const response = await fetch("https://arweave.net/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(query),
    })

    if (!response.ok) {
      throw new Error(`GraphQL query failed: ${response.status}`)
    }

    const result = await response.json()

    if (result.errors) {
      console.error("GraphQL errors:", result.errors)
      throw new Error(`GraphQL query failed: ${result.errors[0]?.message}`)
    }

    const transactions = result.data?.transactions?.edges

    if (!transactions || transactions.length === 0) {
      return null
    }

    // 获取最新的交易
    const transaction = transactions[0].node

    // 验证返回的交易确实是由该地址发起的（双重验证）
    if (transaction.owner.address !== ownerAddress) {
      throw new Error(
        `Manifest transaction owner mismatch: expected ${ownerAddress}, got ${transaction.owner.address}`,
      )
    }

    // 验证 App-Name 标签（双重验证）
    const appNameTag = transaction.tags.find(
      (tag: { name: string; value: string }) => tag.name === "App-Name",
    )
    if (!appNameTag || appNameTag.value !== MANIFEST_APP_NAME) {
      throw new Error(
        `Manifest transaction App-Name mismatch: expected ${MANIFEST_APP_NAME}, got ${appNameTag?.value}`,
      )
    }

    // 验证 Owner-Address 标签（双重验证）
    const ownerAddressTag = transaction.tags.find(
      (tag: { name: string; value: string }) => tag.name === "Owner-Address",
    )
    if (!ownerAddressTag || ownerAddressTag.value !== ownerAddress) {
      throw new Error(
        `Manifest transaction Owner-Address tag mismatch: expected ${ownerAddress}, got ${ownerAddressTag?.value}`,
      )
    }

    const latestTxId = transaction.id

    // 下载清单文件内容（增量清单）
    const manifest = await downloadManifestByTxId(latestTxId)
    if (!manifest) {
      return null
    }

    // 合并版本链生成完整清单
    console.log(`[downloadManifest] Merging incremental manifest chain...`)
    const merged = await mergeManifestChain(latestTxId)
    if (!merged) {
      throw new Error("Failed to merge manifest chain")
    }

    // 验证账户地址（三重验证）
    if (merged.ownerAddress !== ownerAddress) {
      throw new Error("Manifest owner address mismatch")
    }

    return merged
  } catch (error) {
    console.error("Failed to download manifest:", error)
    return null
  }
}

/**
 * 同步文件记录到本地数据库
 */
export async function syncFilesFromArweave(
  ownerAddress: string,
  manifest: FileManifest,
): Promise<{ added: number; updated: number; skipped: number }> {
  let added = 0
  let updated = 0
  let skipped = 0

  try {
    for (const fileData of manifest.files) {
      // 检查文件是否已存在
      const existing = await db.get(
        "SELECT id, updated_at FROM file_indexes WHERE id = ?",
        [fileData.id],
      )

      if (existing) {
        // 检查是否需要更新
        const existingUpdatedAt =
          typeof existing.updated_at === "number"
            ? existing.updated_at
            : Number(existing.updated_at)

        if (fileData.updated_at > existingUpdatedAt) {
          // 更新现有记录
          await db.run(
            `UPDATE file_indexes SET
              tx_id = ?,
              file_name = ?,
              file_hash = ?,
              file_size = ?,
              mime_type = ?,
              folder_id = ?,
              description = ?,
              storage_type = ?,
              encryption_algo = ?,
              encryption_params = ?,
              version = ?,
              previous_tx_id = ?,
              updated_at = ?
            WHERE id = ?`,
            [
              fileData.tx_id,
              fileData.file_name,
              fileData.file_hash,
              fileData.file_size,
              fileData.mime_type,
              fileData.folder_id,
              fileData.description,
              fileData.storage_type,
              fileData.encryption_algo,
              fileData.encryption_params,
              fileData.version,
              fileData.previous_tx_id,
              fileData.updated_at,
              fileData.id,
            ],
          )

          // 更新标签
          if (fileData.tags && fileData.tags.length > 0) {
            await db.run("DELETE FROM file_tags WHERE file_id = ?", [
              fileData.id,
            ])
            for (const tag of fileData.tags) {
              await db.run(
                "INSERT OR IGNORE INTO file_tags (file_id, tag) VALUES (?, ?)",
                [fileData.id, tag],
              )
            }
          }

          updated++
        } else {
          skipped++
        }
      } else {
        // 插入新记录
        await db.run(
          `INSERT INTO file_indexes (
            id, tx_id, file_name, file_hash, file_size, mime_type,
            folder_id, description, owner_address, storage_type,
            encryption_algo, encryption_params, version, previous_tx_id,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            fileData.id,
            fileData.tx_id,
            fileData.file_name,
            fileData.file_hash,
            fileData.file_size,
            fileData.mime_type,
            fileData.folder_id,
            fileData.description,
            ownerAddress,
            fileData.storage_type,
            fileData.encryption_algo,
            fileData.encryption_params,
            fileData.version,
            fileData.previous_tx_id,
            fileData.created_at,
            fileData.updated_at,
          ],
        )

        // 插入标签
        if (fileData.tags && fileData.tags.length > 0) {
          for (const tag of fileData.tags) {
            await db.run(
              "INSERT OR IGNORE INTO file_tags (file_id, tag) VALUES (?, ?)",
              [fileData.id, tag],
            )
          }
        }

        // 更新全文搜索索引
        const fileRecord = await db.get(
          "SELECT rowid FROM file_indexes WHERE id = ?",
          [fileData.id],
        )
        if (fileRecord) {
          await db.run(
            `INSERT INTO file_indexes_fts (rowid, file_name, description)
             VALUES (?, ?, ?)`,
            [fileRecord.rowid, fileData.file_name, fileData.description || ""],
          )
        }

        added++
      }
    }

    return { added, updated, skipped }
  } catch (error) {
    console.error("Failed to sync files:", error)
    throw error
  }
}

/**
 * 增量更新清单（上传新文件后调用）
 * 使用增量清单方案，大幅减少清单文件大小和费用
 * 注意：通常应该通过 manifest-updater 的批量更新机制调用，而不是直接调用此函数
 */
export async function updateManifestAfterUpload(
  ownerAddress: string,
  key: WalletKey,
  useExternalWallet?: boolean,
): Promise<string | null> {
  try {
    console.log(
      `[updateManifestAfterUpload] Updating manifest for ${ownerAddress}`,
    )
    // 使用增量清单上传（统一方案）
    const txId = await uploadIncrementalManifest(
      ownerAddress,
      key,
      useExternalWallet,
    )
    console.log(
      `[updateManifestAfterUpload] Manifest updated successfully: ${txId}`,
    )
    return txId
  } catch (error) {
    console.error("Failed to update manifest:", error)
    return null
  }
}

/**
 * 在浏览器空闲时间调度清单更新，避免阻塞页面渲染和交互
 * 使用 requestIdleCallback 确保在浏览器空闲时执行
 */
export function scheduleManifestUpdate(
  ownerAddress: string,
  key: WalletKey,
  useExternalWallet?: boolean,
): void {
  // 使用 requestIdleCallback 在空闲时间执行清单更新
  requestIdleCallbackPolyfill(
    async (deadline) => {
      // 检查是否有足够的空闲时间
      if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
        try {
          await updateManifestAfterUpload(ownerAddress, key, useExternalWallet)
        } catch (error) {
          console.error(
            "[scheduleManifestUpdate] Failed to update manifest:",
            error,
          )
        }
      } else {
        // 如果当前没有空闲时间，重新调度
        scheduleManifestUpdate(ownerAddress, key, useExternalWallet)
      }
    },
    { timeout: 5000 }, // 最多等待 5 秒
  )
}
