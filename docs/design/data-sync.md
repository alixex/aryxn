# 清单文件更新机制

## 问题：Arweave 数据不可变

Arweave 上的数据是**不可变的（immutable）**，一旦上传就无法修改或删除。那么，当用户不断上传新文件时，清单文件如何更新？

## 解决方案：版本化清单文件

### 核心思路

**每次更新时，创建一个新的清单文件交易**，而不是修改旧的清单文件。

通过查询**最新的清单文件**（按区块高度降序，取第一个），就可以获取包含所有文件的最新清单。

### 工作机制

```
时间线：
T1: 上传文件1 → 创建清单1 (包含文件1)
T2: 上传文件2 → 创建清单2 (包含文件1 + 文件2)
T3: 上传文件3 → 创建清单3 (包含文件1 + 文件2 + 文件3)
...

Arweave 上存储：
- 清单1 (tx_manifest_1) - 包含文件1
- 清单2 (tx_manifest_2) - 包含文件1 + 文件2
- 清单3 (tx_manifest_3) - 包含文件1 + 文件2 + 文件3

查询时：
- 查询最新的清单文件（按区块高度降序，取第一个）
- 获取清单3，包含所有文件 ✅
```

### 查询最新清单的逻辑

#### 为什么使用区块高度（Block Height）？

Arweave 使用**区块高度**而不是时间戳来确定交易的顺序，原因：

1. **确定性**：区块高度是区块链上的绝对顺序，不会因为时间同步问题产生歧义
2. **不可篡改**：区块高度一旦确定就无法改变，确保查询结果的可靠性
3. **性能**：区块高度是索引字段，查询速度更快

#### 查询步骤

**步骤 1：通过 GraphQL API 查询最新清单交易**

```graphql
query GetLatestManifest(
  $owner: [String!]!
  $appName: String!
  $ownerAddress: String!
) {
  transactions(
    owners: $owner # 1. 查询该地址发起的交易
    tags: [
      { name: "App-Name", values: [$appName] } # 2. 必须是清单文件
      { name: "Owner-Address", values: [$ownerAddress] } # 3. 必须是该账户的清单
    ]
    sort: HEIGHT_DESC # 4. 按区块高度降序（最新的在前）
    first: 1 # 5. 只取第一个（最新的）
  ) {
    edges {
      node {
        id # 交易 ID（清单文件的交易 ID）
        tags {
          name
          value
        }
      }
    }
  }
}
```

**步骤 2：下载清单文件内容**

```typescript
// 获取最新的交易 ID
const latestTxId = transactions[0].node.id

// 从 Arweave 下载清单文件内容
const manifest = await downloadManifestByTxId(latestTxId)
```

**步骤 3：如果是增量清单，合并版本链**

```typescript
// 增量清单：沿着 previousManifestTxId 向上遍历，合并所有增量清单
const merged = await mergeManifestChain(latestTxId)
return merged
```

#### 查询条件说明

| 条件                             | 说明                 | 作用                                 |
| -------------------------------- | -------------------- | ------------------------------------ |
| `owners: [ownerAddress]`         | 查询该地址发起的交易 | 确保只查询当前账户的清单文件         |
| `App-Name: "Aryxn-Manifest"` | 清单文件的标识标签   | 区分清单文件和其他文件交易           |
| `Owner-Address: ownerAddress`    | 账户地址标签         | 双重验证，确保是当前账户的清单       |
| `sort: HEIGHT_DESC`              | 按区块高度降序       | 最新的清单（区块高度最大）排在第一位 |
| `first: 1`                       | 只取第一个结果       | 获取最新的清单文件交易 ID            |

#### 为什么这样能找到最新清单？

1. **区块高度递增**：每次上传清单文件时，Arweave 会将其打包到当前区块，区块高度是递增的
2. **降序排序**：`HEIGHT_DESC` 将区块高度最大的交易排在第一位
3. **取第一个**：`first: 1` 确保只获取最新的清单文件

#### 如果找不到清单文件怎么办？

- **返回 `null`**：表示该账户还没有上传过清单文件（首次使用）
- **首次上传**：`previousManifestTxId` 为 `null`，包含所有文件

#### 完整流程示例

```typescript
// 1. 查询最新清单交易 ID
const latestTxId = await getLatestManifestTxId(ownerAddress)
// 返回："tx_manifest_123..." 或 null（首次使用）

if (!latestTxId) {
  // 首次使用，没有清单文件
  return null
}

// 2. 下载清单文件内容
const manifest = await downloadManifestByTxId(latestTxId)

// 3. 合并版本链
// 增量清单：previousManifestTxId = "tx_manifest_122..."
// 沿着版本链向上遍历：
// tx_manifest_123 → tx_manifest_122 → tx_manifest_121 → ... → null
// 合并所有增量清单，得到完整清单
const merged = await mergeManifestChain(latestTxId)
return merged

// 返回合并后的完整清单
return merged
```

## 更新策略

### 策略：批量更新 + 增量清单（当前实现）

系统使用**批量更新机制**来减少清单文件数量：

**更新策略**：

1. **批量上传**：批量上传完成后，在浏览器空闲时间更新清单

   ```typescript
   // 批量上传文件（禁用单个文件的清单更新）
   for (const file of files) {
     await uploadFile(file, ownerAddress, key, {
       updateManifest: false, // 禁用单个文件的清单更新
     })
   }

   // 批量上传完成后，在浏览器空闲时间更新清单（避免阻塞页面）
   scheduleManifestUpdate(ownerAddress, key)
   ```

2. **单个文件上传**：在浏览器空闲时间更新清单

   ```typescript
   async function uploadFile(...) {
     // 1. 上传文件
     const txId = await uploadToArweave(file, ...)

     // 2. 保存到本地数据库
     await db.run("INSERT INTO file_indexes ...")

     // 3. 在浏览器空闲时间更新清单（使用增量清单，避免阻塞页面）
     scheduleManifestUpdate(ownerAddress, key)
   }
   ```

**优点**：

- ✅ 清单文件与文件一起上传，保持一致性
- ✅ 实时同步，无需等待
- ✅ 降低存储费用（使用增量清单，每次只包含新增文件）
- ✅ 跨设备访问时，清单文件始终是最新的

## 增量清单方案（统一方案）

### 核心思想

项目统一采用增量清单方案，通过版本链（链表）结构，每次只上传新增的文件，大幅减少清单文件大小和存储费用。无论是首次上传还是后续更新，都使用增量清单。

### 版本链结构

```
清单1 (增量) → 清单2 (增量) → 清单3 (增量) → 清单4 (增量) → ...
   ↓              ↓              ↓              ↓
文件1-10      新增文件11-20   新增文件21-30   新增文件31-40
```

### 工作原理

1. **首次上传**：创建增量清单（previousManifestTxId 为 null，包含所有文件）
2. **后续更新**：创建增量清单（只包含新增的文件）
3. **版本链**：每个清单指向上一个清单的交易 ID（首次为 null）
4. **合并查询**：下载时沿着版本链向上遍历，合并所有增量清单
5. **实时更新**：每次文件上传后立即更新清单，无论是单个文件还是批量上传

### 数据结构

#### 增量清单（统一方案）

```typescript
interface IncrementalManifest {
  version: "1.1.0"
  ownerAddress: string
  lastUpdated: number
  previousManifestTxId: string | null // 首次上传时为 null
  added: FileIndex[] // 新增的文件（首次上传时包含所有文件）
}
```

**首次上传示例**（previousManifestTxId 为 null）：

```typescript
{
  version: "1.1.0",
  ownerAddress: "abc123...xyz789",
  lastUpdated: 1234567890,
  previousManifestTxId: null, // 首次上传
  added: [
    // 所有文件
  ]
}
```

### 费用对比

假设有 1000 个文件，每次新增 10 个文件：

| 方案     | 每次更新大小 | 100 次更新总大小 | 费用估算（一次性支付） |
| -------- | ------------ | ---------------- | ---------------------- |
| 完整清单 | ~500KB       | ~50MB            | ~$1.00                 |
| 增量清单 | ~5KB         | ~500KB           | ~$0.01                 |

**费用节省：99%** 🎉

**重要说明**：

- Arweave 存储费用是**一次性支付**的，数据永久存储
- 每次上传清单文件都需要支付一次存储费用
- 增量清单的优势在于**每次支付的费用更少**（因为文件更小）
- 如果用户频繁更新清单（如 100 次），总费用节省可达 99%

**优势**：

- ✅ 每次上传都可以看到清单文件的大小和费用
- ✅ 清单文件与文件一起上传，保持一致性
- ✅ 无论是单个文件还是批量上传，都使用相同的增量清单方案
- ✅ 在浏览器空闲时间执行清单更新，不阻塞页面渲染和交互

### 合并版本链

下载时沿着版本链向上遍历，合并所有增量清单：

```typescript
async function mergeManifestChain(latestTxId: string): Promise<FileManifest> {
  const files = new Map<string, FileIndex>()
  let currentTxId: string | null = latestTxId

  // 沿着版本链向上遍历
  while (currentTxId) {
    const manifest = await downloadManifestByTxId(currentTxId)
    if (!manifest) {
      break
    }

    // 增量清单：添加新增的文件
    const incremental = manifest as IncrementalManifest
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

    // 继续向上遍历（previousManifestTxId 可能为 null，首次上传时）
    currentTxId = incremental.previousManifestTxId
  }

  // 构建完整清单（合并后的结果）
  return {
    version: "1.0.0",
    ownerAddress,
    lastUpdated: Date.now(),
    files: Array.from(files.values()),
  }
}
```

**关键点**：

- `previousManifestTxId` 可能为 `null`（首次上传时）
- 当 `currentTxId` 为 `null` 时，while 循环停止
- 所有增量清单都会被合并成完整清单（用于同步到本地数据库）

## 清单文件版本链

### 数据结构

```typescript
interface ManifestVersion {
  txId: string // 清单文件交易 ID
  previousTxId: string | null // 上一个清单文件的交易 ID
  fileCount: number // 包含的文件数量
  createdAt: number // 创建时间戳
  blockHeight: number // 区块高度
}
```

### 版本链查询

```typescript
// 查询所有清单文件版本（用于调试或恢复）
async function getManifestVersions(
  ownerAddress: string,
): Promise<ManifestVersion[]> {
  const query = {
    query: `
      query GetManifestVersions($owner: [String!]!, $appName: String!, $ownerAddress: String!) {
        transactions(
          owners: $owner
          tags: [
            { name: "App-Name", values: [$appName] }
            { name: "Owner-Address", values: [$ownerAddress] }
          ]
          sort: HEIGHT_DESC
          first: 100  # 获取最近 100 个版本
        ) {
          edges {
            node {
              id
              block {
                height
                timestamp
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

  // ... 执行查询并返回版本列表
}
```

## 费用优化

### 清单文件大小

清单文件大小随文件数量增长：

```
单个文件记录大小：约 500-1000 字节（JSON格式）
1000个文件：约 500KB - 1MB
10000个文件：约 5MB - 10MB
```

### 费用计算

```
清单文件费用 = 文件大小 × Arweave 存储费用率

示例：
- 1000个文件：约 500KB，费用约 $0.01
- 10000个文件：约 5MB，费用约 $0.10
```

### 优化建议

1. **使用增量清单**：只包含新增文件，可减少 99% 费用
2. **批量更新**：延迟更新，减少清单文件数量
3. **压缩清单文件**：使用 gzip 压缩，可减少 70-80% 大小（可选）

## 错误处理

如果增量清单上传失败，会记录错误并返回 null：

```typescript
try {
  // 上传增量清单
  return await uploadIncrementalManifest(ownerAddress, key)
} catch (error) {
  // 记录错误，不进行回退
  console.error("Failed to update manifest:", error)
  return null
}
```

## 最佳实践

### 1. 统一使用增量清单

无论是首次上传还是后续更新，都使用增量清单：

```typescript
// 首次上传：previousManifestTxId 为 null，包含所有文件
// 后续更新：previousManifestTxId 指向上一个清单，只包含新增文件
await uploadIncrementalManifest(ownerAddress, key)
```

### 2. 立即更新清单

无论是单个文件还是批量上传，都立即更新清单：

```typescript
// 单个文件上传
await uploadFile(file, ownerAddress, key)
// uploadFile 内部会自动调用 updateManifestAfterUpload

// 批量上传
for (const file of files) {
  await uploadFile(file, ownerAddress, key, {
    updateManifest: false, // 禁用单个文件的清单更新
  })
}
// 批量上传完成后，统一更新清单
await updateManifestAfterUpload(ownerAddress, key)
```

### 3. 费用透明

每次上传都可以看到：

- 文件大小和费用
- 清单文件大小和费用
- 总费用

这样可以更好地控制存储成本。

**性能优化**：

- 清单更新在浏览器空闲时间执行（使用 `requestIdleCallback`），不会阻塞页面渲染和用户交互
- 如果浏览器不支持 `requestIdleCallback`，会自动降级到 `setTimeout`，确保兼容性
- 文件同步操作（如下载清单、合并版本链）也使用空闲时间执行，确保页面流畅性

## 总结

### 核心机制

1. **Arweave 数据不可变**：无法修改已上传的数据
2. **版本化清单**：每次更新创建新的清单文件交易
3. **查询最新版本**：通过 `sort: HEIGHT_DESC` + `first: 1` 获取最新清单
4. **包含所有文件**：最新清单包含所有历史文件

### 更新策略

| 策略     | 更新频率     | 费用 | 实时性 | 推荐场景         |
| -------- | ------------ | ---- | ------ | ---------------- |
| 立即更新 | 每次上传立即 | 低   | 最高   | 所有场景（推荐） |
| 增量清单 | 每次上传立即 | 低   | 最高   | 所有场景（推荐） |

### 最佳实践

1. **统一使用增量清单**：无论是首次上传还是后续更新，都使用增量清单方案
2. **立即更新清单**：每次文件上传后立即更新清单，保持一致性
3. **费用透明**：每次上传都可以看到文件大小、清单大小和费用
4. **批量上传优化**：批量上传时，禁用单个文件的清单更新，批量完成后统一更新
5. **记录版本链**：便于调试和恢复

通过合理的更新策略，可以在保证数据完整性的同时，优化存储费用和查询效率。

```
if (!current) throw new Error("File not found")

// 上传新版本
const newTxId = await uploadToArweave(newFile, key, encryptionKey)

// 更新索引
await db.run(
/'     UPDATE file_indexes
    SET tx_id = ?, file_hash = ?, file_size = ?, version = ?, previous_tx_id = ?, updated_at = ?
    WHERE id = ?
  /',
[
newTxId,
await calculateFileHash(newFile),
newFile.size,
current.version + 1,
current.tx_id,
Date.now(),
fileId,
],
)

return newTxId

```

### 4. 文件夹管理

```typescript
// 创建文件夹
async function createFolder(
  name: string,
  ownerAddress: string,
  parentId: string | null = null,
  options?: { color?: string; icon?: string; description?: string },
): Promise<string> {
  const folderId = crypto.randomUUID()
  await db.run(
    `
    INSERT INTO folders (id, name, parent_id, owner_address, color, icon, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      folderId,
      name,
      parentId,
      ownerAddress,
      options?.color || null,
      options?.icon || null,
      options?.description || null,
      Date.now(),
      Date.now(),
    ],
  )
  return folderId
}

// 获取文件夹树
async function getFolderTree(ownerAddress: string): Promise<FolderTreeNode[]> {
  const folders = await db.all(
    "SELECT * FROM folders WHERE owner_address = ?",
    [ownerAddress],
  )

  // 构建树结构
  const folderMap = new Map<string, FolderTreeNode>()
  const rootFolders: FolderTreeNode[] = []

  folders.forEach((folder) => {
    const node: FolderTreeNode = {
      ...folder,
      children: [],
      fileCount: 0,
    }
    folderMap.set(folder.id, node)
  })

  folders.forEach((folder) => {
    const node = folderMap.get(folder.id)!
    if (folder.parent_id === null) {
      rootFolders.push(node)
    } else {
      const parent = folderMap.get(folder.parent_id)
      if (parent) parent.children.push(node)
    }
  })

  // 计算文件数量
  for (const node of folderMap.values()) {
    const result = await db.get(
      "SELECT COUNT(*) as count FROM file_indexes WHERE folder_id = ?",
      [node.id],
    )
    node.fileCount = result.count
  }

  return rootFolders
}
```

### 5. 链上索引同步

```typescript
// 同步索引到 Arweave
async function syncIndexToArweave(
  ownerAddress: string,
  key: any,
  encryptionKey?: Uint8Array,
): Promise<string> {
  // 1. 获取所有数据
  const folders = await db.all(
    "SELECT * FROM folders WHERE owner_address = ?",
    [ownerAddress],
  )
  const files = await db.all(
    `
    SELECT fi.*, GROUP_CONCAT(ft.tag) as tags
    FROM file_indexes fi
    LEFT JOIN file_tags ft ON fi.id = ft.file_id
    WHERE fi.owner_address = ?
    GROUP BY fi.id
  `,
    [ownerAddress],
  )

  // 2. 获取上一个清单
  const previousManifest = await db.get(
    "SELECT tx_id FROM index_manifests WHERE owner_address = ? ORDER BY created_at DESC LIMIT 1",
    [ownerAddress],
  )

  // 3. 创建清单
  const manifest = {
    version: "1.0.0",
    ownerAddress,
    folders,
    files: files.map((f) => ({ ...f, tags: f.tags ? f.tags.split(",") : [] })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    previousManifestTxId: previousManifest?.tx_id,
  }

  // 4. 上传清单
  const manifestData = new TextEncoder().encode(JSON.stringify(manifest))
  let data = manifestData

  if (encryptionKey) {
    const { ciphertext } = await encryptData(manifestData, encryptionKey)
    data = ciphertext
  }

  const transaction = await arweave.createTransaction({ data }, key)
  transaction.addTag("Content-Type", "application/json")
  transaction.addTag("App-Name", "Aryxn")
  transaction.addTag("Index-Type", "manifest")
  transaction.addTag("Owner-Address", ownerAddress)

  await arweave.transactions.sign(transaction, key)
  const response = await arweave.transactions.post(transaction)

  if (response.status === 200) {
    await db.run(
      "INSERT INTO index_manifests (tx_id, owner_address, created_at) VALUES (?, ?, ?)",
      [transaction.id, ownerAddress, Date.now()],
    )
    return transaction.id
  } else {
    throw new Error(`Failed to upload manifest: ${response.status}`)
  }
}

// 从 Arweave 恢复索引
async function restoreIndexFromArweave(
  manifestTxId: string,
  ownerAddress: string,
  key: any,
  masterKey?: Uint8Array,
): Promise<void> {
  // 1. 获取清单
  const response = await fetch(`https://arweave.net/${manifestTxId}`)
  let data = new Uint8Array(await response.arrayBuffer())

  // 2. 解密
  const tx = await arweave.transactions.get(manifestTxId)
  const encryptionAlgo = tx.tags.find(
    (t) => t.name === "Encryption-Algo",
  )?.value
  if (encryptionAlgo && encryptionAlgo !== "none" && masterKey) {
    const params = JSON.parse(
      tx.tags.find((t) => t.name === "Encryption-Params")?.value || "{}",
    )
    const nonce = fromBase64(params.nonce)
    data = await decryptData(data, nonce, masterKey)
  }

  // 3. 解析清单
  const manifest = JSON.parse(new TextDecoder().decode(data))

  // 4. 恢复数据
  await db.run("BEGIN TRANSACTION")
  try {
    // 清空现有数据（可选，或合并）
    await db.run(
      "DELETE FROM file_tags WHERE file_id IN (SELECT id FROM file_indexes WHERE owner_address = ?)",
      [ownerAddress],
    )
    await db.run("DELETE FROM file_indexes WHERE owner_address = ?", [
      ownerAddress,
    ])
    await db.run("DELETE FROM folders WHERE owner_address = ?", [ownerAddress])

    // 插入文件夹
    for (const folder of manifest.folders) {
      await db.run(
        `
        INSERT INTO folders (id, name, parent_id, owner_address, color, icon, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          folder.id,
          folder.name,
          folder.parentId,
          folder.ownerAddress,
          folder.color,
          folder.icon,
          folder.description,
          folder.createdAt,
          folder.updatedAt,
        ],
      )
    }

    // 插入文件索引
    for (const file of manifest.files) {
      await db.run(
        `
        INSERT INTO file_indexes (
          id, tx_id, file_name, file_hash, file_size, mime_type,
          folder_id, description, owner_address, storage_type,
          encryption_algo, encryption_params, version, previous_tx_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          file.id,
          file.txId,
          file.fileName,
          file.fileHash,
          file.fileSize,
          file.mimeType,
          file.folderId,
          file.description,
          file.ownerAddress,
          file.storageType,
          file.encryptionAlgo,
          file.encryptionParams,
          file.version,
          file.previousTxId,
          file.createdAt,
          file.updatedAt,
        ],
      )

      // 插入标签
      if (file.tags?.length) {
        for (const tag of file.tags) {
          await db.run("INSERT INTO file_tags (file_id, tag) VALUES (?, ?)", [
            file.id,
            tag,
          ])
        }
      }
    }

    await db.run("COMMIT")
  } catch (error) {
    await db.run("ROLLBACK")
    throw error
  }
}
```

## 工具函数

```typescript
// 文件哈希计算
async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}
```

## 安全性

### SQL 注入防护

所有 SQL 查询都使用**参数化查询**（Prepared Statements），确保用户输入不会被解释为 SQL 代码：

1. **参数化查询**：所有用户输入都通过 `?` 占位符传递

   ```typescript
   // ✅ 正确：使用参数化查询
   db.run("SELECT * FROM file_indexes WHERE id = ?", [fileId])

   // ❌ 错误：直接拼接字符串
   db.run(`SELECT * FROM file_indexes WHERE id = '${fileId}'`)
   ```

2. **字段名白名单**：动态字段名使用白名单验证

   ```typescript
   // ✅ 正确：字段名硬编码
   updatesList.push("file_name = ?")

   // ❌ 错误：字段名来自用户输入
   updatesList.push(`${userInput} = ?`)
   ```

3. **FTS5 查询转义**：全文搜索查询通过参数传递，SQLite WASM 会自动处理转义

4. **数值验证**：LIMIT/OFFSET 等数值参数通过参数传递，确保类型安全

### 输入验证

- **文件 ID**：使用 UUID 格式验证
- **地址验证**：验证 Arweave 地址格式
- **数值范围**：验证日期范围、文件大小等数值参数

## 性能优化

1. **索引优化**：为常用查询字段创建索引
2. **全文搜索**：使用 FTS5 虚拟表
3. **批量操作**：使用事务批量插入/更新
4. **分页查询**：使用 LIMIT/OFFSET
5. **延迟同步**：批量更新后统一同步

## 总结

本方案采用 SQLite WASM 提供：

- ✅ 高性能查询和全文搜索
- ✅ 统一的数据管理接口
- ✅ 完整的 CRUD 操作
- ✅ 链上索引同步
- ✅ 简洁的架构设计
