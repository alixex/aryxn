import { db } from "@/lib/database"
import { type DbRow, type SqlValue } from "@aryxn/storage"
import { uploadToArweave } from "@/lib/storage"
import type { WalletKey } from "@aryxn/wallet-core"

// 类型定义
export interface FileIndex {
  id: string
  tx_id: string
  file_name: string
  file_hash: string
  file_size: number
  mime_type: string
  folder_id: string | null
  description: string | null
  owner_address: string
  storage_type: string
  encryption_algo: string
  encryption_params: string
  version: number
  previous_tx_id: string | null
  created_at: number
  updated_at: number
  tags?: string[]
}

export interface Folder {
  id: string
  name: string
  parent_id: string | null
  owner_address: string
  color: string | null
  icon: string | null
  description: string | null
  created_at: number
  updated_at: number
}

export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[]
  fileCount: number
}

export interface SearchOptions {
  query?: string
  folderId?: string | null
  tags?: string[]
  mimeType?: string
  encrypted?: boolean
  dateRange?: { start: number; end: number }
  limit?: number
  offset?: number
}

/**
 * 计算文件哈希（SHA-256）
 */
export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * 计算数据哈希（SHA-256）
 */
export async function calculateDataHash(data: Uint8Array): Promise<string> {
  // 确保创建新的 ArrayBuffer，避免 SharedArrayBuffer 的问题
  const newBuffer = new ArrayBuffer(data.length)
  const newData = new Uint8Array(newBuffer)
  newData.set(data)
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    newBuffer as ArrayBuffer,
  )
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * 上传文件
 */
export async function uploadFile(
  file: File,
  ownerAddress: string,
  key: WalletKey,
  options: {
    folderId?: string | null
    tags?: string[]
    description?: string
    encryptionKey?: Uint8Array
    useExternalWallet?: boolean
    enableCompression?: boolean
    updateManifest?: boolean // 是否自动更新清单（默认 true）
    onProgress?: (progress: { stage: string; progress: number }) => void // 进度回调
  } = {},
): Promise<{ txId: string; fileId: string }> {
  // 1. 上传文件到 Arweave（传递账户地址用于标签）
  // 注意：hash 是在压缩和加密后的最终数据上计算的
  const uploadResult = await uploadToArweave(
    file,
    key,
    options.encryptionKey,
    options.useExternalWallet,
    options.enableCompression,
    ownerAddress, // 传递账户地址
    options.onProgress, // 传递进度回调
  )
  const { txId, hash: fileHash, finalSize, encryptionParams } = uploadResult

  // 2. 检查是否已存在（基于最终上传数据的 hash）
  const existing = await db.get(
    "SELECT id, tx_id, version FROM file_indexes WHERE file_hash = ? AND owner_address = ?",
    [fileHash, ownerAddress],
  )

  let version = 1
  let previousTxId: string | undefined

  if (existing) {
    const existingVersion =
      typeof existing.version === "number" ? existing.version : 1
    version = existingVersion + 1
    previousTxId =
      typeof existing.tx_id === "string" ? existing.tx_id : undefined
  }

  // 3. 创建文件索引
  const fileId = crypto.randomUUID()
  const now = Date.now()

  await db.run(
    `INSERT INTO file_indexes (
      id, tx_id, file_name, file_hash, file_size, mime_type,
      folder_id, description, owner_address, storage_type,
      encryption_algo, encryption_params, version, previous_tx_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fileId,
      txId,
      file.name,
      fileHash, // 使用最终上传数据的 hash
      finalSize, // 使用最终上传数据的大小（压缩和加密后）
      file.type,
      options.folderId || null,
      options.description || null,
      ownerAddress,
      "arweave",
      options.encryptionKey ? "XChaCha20-Poly1305" : "none",
      encryptionParams || "{}",
      version,
      previousTxId || null,
      now,
      now,
    ],
  )

  // 5. 保存标签
  if (options.tags?.length) {
    for (const tag of options.tags) {
      await db.run(
        "INSERT OR IGNORE INTO file_tags (file_id, tag) VALUES (?, ?)",
        [fileId, tag],
      )
    }
  }

  // 6. 更新全文搜索索引
  // 获取 rowid
  const fileRecord = await db.get(
    "SELECT rowid FROM file_indexes WHERE id = ?",
    [fileId],
  )

  if (fileRecord) {
    await db.run(
      `INSERT INTO file_indexes_fts (rowid, file_name, description)
       VALUES (?, ?, ?)`,
      [fileRecord.rowid, file.name, options.description || ""],
    )
  }

  // 7. 如果启用清单更新，在浏览器空闲时间更新清单
  if (options.updateManifest !== false) {
    // 在空闲时间更新清单文件（使用增量清单），避免阻塞页面渲染和交互
    // 使用动态导入避免循环依赖
    try {
      const { scheduleManifestUpdate } = await import("./file-sync")
      scheduleManifestUpdate(ownerAddress, key, options.useExternalWallet)
    } catch (error) {
      console.warn(
        "Failed to schedule manifest update (file-sync not available):",
        error,
      )
    }
  }

  // 8. 在浏览器空闲时间自动同步文件记录（从 Arweave 拉取最新文件）
  // 这样其他设备上传的文件也能自动同步到本地
  try {
    const { scheduleAutoSync } = await import("./file-sync-direct")
    scheduleAutoSync(ownerAddress)
  } catch (error) {
    console.warn(
      "Failed to schedule auto sync (file-sync-direct not available):",
      error,
    )
  }

  return { txId, fileId }
}

/**
 * 批量上传文件
 */
export async function uploadFiles(
  files: File[],
  ownerAddress: string,
  key: WalletKey,
  options: {
    folderId?: string | null
    tags?: string[]
    encryptionKey?: Uint8Array
    useExternalWallet?: boolean
    enableCompression?: boolean
    onProgress?: (progress: { stage: string; progress: number }) => void
  } = {},
): Promise<
  Array<{ success: boolean; txId?: string; fileId?: string; error?: string }>
> {
  const results = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (options.onProgress) {
      options.onProgress({
        stage: `Uploading ${i + 1}/${files.length}: ${file.name}`,
        progress: Math.floor((i / files.length) * 100),
      })
    }

    try {
      const result = await uploadFile(file, ownerAddress, key, {
        ...options,
        updateManifest: false, // Don't update manifest for each file in batch
      })
      results.push({ success: true, ...result })
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error)
      results.push({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // After batch upload, schedule a single manifest update if any succeeded
  if (results.some((r) => r.success)) {
    try {
      const { scheduleManifestUpdate } = await import("./file-sync")
      scheduleManifestUpdate(ownerAddress, key, options.useExternalWallet)
    } catch (error) {
      console.warn("Failed to schedule manifest update after batch:", error)
    }
  }

  return results
}

/**
 * 搜索文件
 */
export async function searchFiles(
  ownerAddress: string,
  options: SearchOptions = {},
): Promise<FileIndex[]> {
  const params: SqlValue[] = [ownerAddress]
  const conditions: string[] = ["fi.owner_address = ?"]

  // 全文搜索
  let needsFtsJoin = false
  if (options.query) {
    const queryTrimmed = options.query.trim()
    if (queryTrimmed) {
      needsFtsJoin = true
      // FTS5 MATCH 查询
      // 注意：FTS5 不支持在 WHERE 子句中使用 OR 组合多个 MATCH
      // 解决方案：直接在所有列中搜索（FTS5 表只有 file_name 和 description）
      // 转义 FTS5 查询字符串中的特殊字符
      // 注意：FTS5 MATCH 查询的参数值应该是 FTS5 查询语法字符串，而不是 SQL 字符串
      // 但是我们的参数化查询系统会将所有字符串转义为 SQL 字符串，导致语法错误
      // 因此，我们需要直接将 FTS5 查询字符串嵌入 SQL，但必须转义 SQL 字符串中的单引号
      const escapeFtsQuery = (query: string): string => {
        // FTS5 查询语法转义：转义双引号（用于短语搜索）
        // 双引号在 FTS5 中用于短语搜索，需要转义为两个双引号
        return query.replace(/"/g, '""')
      }
      const escapedQuery = escapeFtsQuery(queryTrimmed)
      // 确保转义后的查询不为空
      if (escapedQuery) {
        // 对于包含特殊字符或空格的查询，使用双引号包裹以确保作为短语搜索
        // 这样可以正确处理文件名如 "aryxn.png" 等
        const needsQuotes = /[\s./+*?[\](){}|^"'-]/.test(escapedQuery)
        const ftsQueryValue = needsQuotes ? `"${escapedQuery}"` : escapedQuery
        // 直接在所有列中搜索（FTS5 表只有 file_name 和 description，会自动搜索这两列）
        // 将 FTS5 查询字符串嵌入 SQL，转义 SQL 字符串中的单引号
        // 注意：ftsQueryValue 是 FTS5 查询语法，需要作为 SQL 字符串的一部分嵌入
        // 重要：FTS5 MATCH 操作符不能使用表别名，必须使用原始表名 file_indexes_fts
        conditions.push(
          `file_indexes_fts MATCH '${ftsQueryValue.replace(/'/g, "''")}'`,
        )
      }
    }
  }

  // 文件夹筛选
  if (options.folderId !== undefined) {
    if (options.folderId === null) {
      conditions.push("fi.folder_id IS NULL")
    } else {
      conditions.push("fi.folder_id = ?")
      params.push(options.folderId)
    }
  }

  // 标签筛选
  if (options.tags?.length) {
    const placeholders = options.tags.map(() => "?").join(",")
    conditions.push(`EXISTS (
      SELECT 1 FROM file_tags ft2
      WHERE ft2.file_id = fi.id AND ft2.tag IN (${placeholders})
    )`)
    params.push(...options.tags)
  }

  // 文件类型筛选
  if (options.mimeType) {
    conditions.push("fi.mime_type LIKE ?")
    params.push(`${options.mimeType}%`)
  }

  // 加密状态筛选
  if (options.encrypted !== undefined) {
    conditions.push(`fi.encryption_algo ${options.encrypted ? "!=" : "="} ?`)
    params.push("none")
  }

  // 日期范围筛选
  if (options.dateRange) {
    conditions.push("fi.created_at BETWEEN ? AND ?")
    params.push(options.dateRange.start, options.dateRange.end)
  }

  // 构建 SQL
  // 确保如果使用了 file_indexes_fts MATCH，needsFtsJoin 必须为 true
  const hasFtsCondition = conditions.some((c) =>
    c.includes("file_indexes_fts MATCH"),
  )
  if (hasFtsCondition && !needsFtsJoin) {
    needsFtsJoin = true
  }

  let sql = `
    SELECT fi.*, GROUP_CONCAT(ft.tag) as tags
    FROM file_indexes fi
    ${needsFtsJoin ? "JOIN file_indexes_fts fts ON fi.rowid = fts.rowid" : ""}
    LEFT JOIN file_tags ft ON fi.id = ft.file_id
    WHERE ${conditions.join(" AND ")}
    GROUP BY fi.id
    ORDER BY fi.created_at DESC
  `

  // LIMIT 和 OFFSET
  if (options.limit) {
    sql += ` LIMIT ?`
    params.push(options.limit)
    if (options.offset) {
      sql += ` OFFSET ?`
      params.push(options.offset)
    }
  }

  const results = await db.all(sql, params)

  // 处理 tags 字段
  return results.map((row: DbRow) => ({
    ...row,
    tags: typeof row.tags === "string" && row.tags ? row.tags.split(",") : [],
  })) as FileIndex[]
}

/**
 * 更新文件元数据
 */
export async function updateFileMetadata(
  fileId: string,
  updates: {
    fileName?: string
    description?: string
    folderId?: string | null
    tags?: string[]
  },
): Promise<void> {
  const updatesList: string[] = []
  const params: SqlValue[] = []

  if (updates.fileName !== undefined) {
    updatesList.push("file_name = ?")
    params.push(updates.fileName)
  }

  if (updates.description !== undefined) {
    updatesList.push("description = ?")
    params.push(updates.description)
  }

  if (updates.folderId !== undefined) {
    if (updates.folderId === null) {
      updatesList.push("folder_id = NULL")
    } else {
      updatesList.push("folder_id = ?")
      params.push(updates.folderId)
    }
  }

  // 始终更新 updated_at
  updatesList.push("updated_at = ?")
  params.push(Date.now())

  // 添加 WHERE 条件
  params.push(fileId)

  if (updatesList.length === 0) {
    return
  }

  await db.run(
    `UPDATE file_indexes
     SET ${updatesList.join(", ")}
     WHERE id = ?`,
    params,
  )

  // 更新标签
  if (updates.tags !== undefined) {
    await db.run("DELETE FROM file_tags WHERE file_id = ?", [fileId])
    for (const tag of updates.tags) {
      await db.run("INSERT INTO file_tags (file_id, tag) VALUES (?, ?)", [
        fileId,
        tag,
      ])
    }
  }

  // 更新全文搜索索引
  if (updates.fileName || updates.description) {
    const file = await db.get(
      "SELECT rowid, file_name, description FROM file_indexes WHERE id = ?",
      [fileId],
    )
    if (file) {
      await db.run(
        `UPDATE file_indexes_fts
         SET file_name = ?, description = ?
         WHERE rowid = ?`,
        [file.file_name || "", file.description || "", file.rowid],
      )
    }
  }
}

/**
 * 更新文件内容（创建新版本）
 */
export async function updateFileContent(
  fileId: string,
  newFile: File,
  key: WalletKey,
  encryptionKey?: Uint8Array,
  useExternalWallet?: boolean,
  enableCompression?: boolean,
): Promise<string> {
  const current = await db.get("SELECT * FROM file_indexes WHERE id = ?", [
    fileId,
  ])
  if (!current) throw new Error("File not found")

  // 上传新版本（返回最终数据的 hash 和大小）
  const uploadResult = await uploadToArweave(
    newFile,
    key,
    encryptionKey,
    useExternalWallet,
    enableCompression,
  )
  const { txId: newTxId, hash: newHash, finalSize } = uploadResult

  // 更新索引（使用最终上传数据的 hash 和大小）
  await db.run(
    `UPDATE file_indexes
     SET tx_id = ?, file_hash = ?, file_size = ?, version = ?, previous_tx_id = ?, updated_at = ?
     WHERE id = ?`,
    [
      newTxId,
      newHash, // 使用最终上传数据的 hash
      finalSize, // 使用最终上传数据的大小（压缩和加密后）
      (typeof current.version === "number" ? current.version : 1) + 1,
      current.tx_id,
      Date.now(),
      fileId,
    ],
  )

  return newTxId
}

/**
 * 创建文件夹
 */
export async function createFolder(
  name: string,
  ownerAddress: string,
  parentId: string | null = null,
  options?: { color?: string; icon?: string; description?: string },
): Promise<string> {
  const folderId = crypto.randomUUID()
  const now = Date.now()

  await db.run(
    `INSERT INTO folders (id, name, parent_id, owner_address, color, icon, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      folderId,
      name,
      parentId,
      ownerAddress,
      options?.color || null,
      options?.icon || null,
      options?.description || null,
      now,
      now,
    ],
  )

  return folderId
}

/**
 * 获取文件夹树
 */
export async function getFolderTree(
  ownerAddress: string,
): Promise<FolderTreeNode[]> {
  const folders = await db.all(
    "SELECT * FROM folders WHERE owner_address = ?",
    [ownerAddress],
  )

  // 构建树结构
  const folderMap = new Map<string, FolderTreeNode>()
  const rootFolders: FolderTreeNode[] = []

  folders.forEach((folderRow: DbRow) => {
    const folder: Folder = {
      id: String(folderRow.id),
      name: String(folderRow.name),
      parent_id: folderRow.parent_id ? String(folderRow.parent_id) : null,
      owner_address: String(folderRow.owner_address),
      color: folderRow.color ? String(folderRow.color) : null,
      icon: folderRow.icon ? String(folderRow.icon) : null,
      description: folderRow.description ? String(folderRow.description) : null,
      created_at:
        typeof folderRow.created_at === "number"
          ? folderRow.created_at
          : Number(folderRow.created_at),
      updated_at:
        typeof folderRow.updated_at === "number"
          ? folderRow.updated_at
          : Number(folderRow.updated_at),
    }
    const node: FolderTreeNode = {
      ...folder,
      children: [],
      fileCount: 0,
    }
    folderMap.set(folder.id, node)
  })

  folders.forEach((folderRow: DbRow) => {
    const folderId = String(folderRow.id)
    const node = folderMap.get(folderId)!
    const parentId = folderRow.parent_id ? String(folderRow.parent_id) : null
    if (parentId === null) {
      rootFolders.push(node)
    } else {
      const parent = folderMap.get(parentId)
      if (parent) parent.children.push(node)
    }
  })

  // 计算文件数量
  for (const node of folderMap.values()) {
    const result = await db.get(
      "SELECT COUNT(*) as count FROM file_indexes WHERE folder_id = ?",
      [node.id],
    )
    const count = result?.count
    node.fileCount = typeof count === "number" ? count : 0
  }

  return rootFolders
}

/**
 * 删除文件
 */
export async function deleteFile(fileId: string): Promise<void> {
  // 由于设置了 ON DELETE CASCADE，标签会自动删除
  await db.run("DELETE FROM file_indexes WHERE id = ?", [fileId])

  // 删除全文搜索索引
  const file = await db.get("SELECT rowid FROM file_indexes WHERE id = ?", [
    fileId,
  ])
  if (file) {
    await db.run("DELETE FROM file_indexes_fts WHERE rowid = ?", [file.rowid])
  }
}

/**
 * 获取文件详情
 */
export async function getFileById(fileId: string): Promise<FileIndex | null> {
  const file = await db.get("SELECT * FROM file_indexes WHERE id = ?", [fileId])
  if (!file) return null

  const tags = await db.all("SELECT tag FROM file_tags WHERE file_id = ?", [
    fileId,
  ])

  return {
    ...file,
    tags: tags.map((t: DbRow) => String(t.tag || "")),
  } as FileIndex
}
