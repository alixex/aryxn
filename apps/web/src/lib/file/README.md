# File Management and Synchronization

文件管理、索引和跨设备同步功能。

## 目录结构

```
file/
├── file-manager.ts            # 文件 CRUD 和索引管理
├── file-sync.ts               # 文件记录到 Arweave 同步
├── file-sync-direct.ts        # 直接文件同步工具
├── manifest-updater.ts        # Manifest 文件更新
├── index.ts                   # 统一导出
└── README.md                  # 本文件
```

## 核心模块

### `file-manager.ts`

本地文件索引的 CRUD 操作。

```typescript
import {
  uploadFile,
  uploadFiles,
  searchFiles,
  type FileIndex,
} from "@/lib/file"

// 上传单个文件
const file = await uploadFile(fileData, metadata)

// 批量上传
const files = await uploadFiles([file1, file2, file3], metadata)

// 搜索文件
const results = await searchFiles(query, { owner: address })
```

### `file-sync.ts`

将文件记录同步到 Arweave 用于跨设备访问。

```typescript
import { estimateManifestSize, syncFilesToArweave } from "@/lib/file"

// 估计 manifest 大小
const size = await estimateManifestSize(files)

// 同步到 Arweave
const txId = await syncFilesToArweave(files, wallet)
```

### `file-sync-direct.ts`

直接同步工具，支持断点续传和差量同步。

```typescript
import { syncFilesFromArweaveDirect } from "@/lib/file"

// 从 Arweave 直接同步
const synced = await syncFilesFromArweaveDirect(address)
```

### `manifest-updater.ts`

更新和管理文件 manifest。

```typescript
import { updateManifest, createManifest } from "@/lib/file"

// 创建新 manifest
const manifest = await createManifest(files)

// 更新现有 manifest
await updateManifest(manifestTxId, newFiles)
```

## 使用示例

### 场景 1: 上传文件

```typescript
import { uploadFile } from "@/lib/file"

const file = new File(["content"], "myfile.txt", { type: "text/plain" })
const uploaded = await uploadFile(file, {
  owner: userAddress,
  tags: ["document", "2024"],
})
```

### 场景 2: 搜索文件

```typescript
import { searchFiles, type FileIndex } from "@/lib/file"

const myFiles = await searchFiles("", {
  owner: userAddress,
  limit: 50,
})

myFiles.forEach((file: FileIndex) => {
  console.log(`${file.file_name} (${file.file_size} bytes)`)
})
```

### 场景 3: 同步文件列表到 Arweave

```typescript
import { syncFilesToArweave, estimateManifestSize } from "@/lib/file"

const files = await searchFiles("", { owner: address })
const manifestSize = await estimateManifestSize(files)

const txId = await syncFilesToArweave(files, wallet)
console.log(`同步完成，Tx: ${txId}`)
```

### 场景 4: 跨设备同步

```typescript
import { syncFilesFromArweaveDirect } from "@/lib/file"

// 从 Arweave 拉取最新的文件索引
const synced = await syncFilesFromArweaveDirect(userAddress)
console.log(`同步 ${synced} 个文件`)
```

## 数据结构

### `FileIndex`

```typescript
interface FileIndex {
  id: string // 本地唯一 ID
  tx_id: string // Arweave 交易 ID
  file_name: string // 文件名
  file_hash: string // 文件哈希
  file_size: number // 文件大小（字节）
  mime_type: string // MIME 类型
  folder_id: string | null // 所属文件夹
  owner_address: string // 所有者地址
  storage_type: string // 存储类型（"arweave"）
  encryption_algo: string // 加密算法
  version: number // 版本号
  created_at: number // 创建时间戳
  updated_at: number // 更新时间戳
  tags?: string[] // 标签
}
```

### `Folder`

```typescript
interface Folder {
  id: string // 文件夹 ID
  name: string // 文件夹名
  parent_id: string | null // 父文件夹 ID
  owner_address: string // 所有者
  created_at: number
  updated_at: number
}
```

## API 参考

### `uploadFile(file, metadata?)`

上传单个文件。

```typescript
const result = await uploadFile(file, {
  owner: address,
  description: "My document",
  tags: ["important"],
})
// => FileIndex
```

### `uploadFiles(files, metadata?)`

批量上传文件。

```typescript
const results = await uploadFiles(fileList, { owner: address })
// => FileIndex[]
```

### `searchFiles(query, options?)`

搜索文件。

```typescript
interface SearchOptions {
  owner?: string // 按所有者过滤
  tag?: string // 按标签过滤
  before?: number // 时间范围
  after?: number
  limit?: number // 结果限制
  offset?: number // 分页
}
```

### `syncFilesToArweave(files, wallet)`

同步文件索引到 Arweave。

```typescript
const txId = await syncFilesToArweave(files, wallet)
// => transaction ID
```

### `estimateManifestSize(files)`

估计 manifest 文件大小。

```typescript
const bytes = await estimateManifestSize(files)
console.log(`Manifest 约 ${bytes} 字节`)
```

## 工作流程

### 上传流程

```
选择文件
  ↓
压缩 (可选)
  ↓
加密 (可选)
  ↓
上传到 Arweave
  ↓
生成 FileIndex
  ↓
保存到本地 DB
  ↓
同步索引到 Arweave (可选)
```

### 同步流程

```
获取本地文件
  ↓
检查 Arweave 上的最新版本
  ↓
比较版本
  ↓
下载差异文件
  ↓
更新本地索引
  ↓
验证完整性
```

## 最佳实践

✅ **推荐**

```typescript
// 同时处理加密和压缩
await uploadFile(file, {
  encrypt: true,
  compress: true,
  owner: address,
})

// 使用标签组织文件
await uploadFile(file, {
  tags: ["category", "year-2024", "draft"],
})

// 定期同步
setInterval(() => syncFilesFromArweaveDirect(address), 3600000)
```

❌ **不推荐**

```typescript
// 单个上传无加密
await uploadFile(file, {})

// 忽略错误
await uploadFile(file) // 没有 try-catch

// 创建大量未同步的本地文件
for (let i = 0; i < 1000; i++) {
  await uploadFile(file)
}
```

## 依赖关系

- `@/lib/storage` - Arweave 上传操作
- `@/lib/utils` - 压缩工具
- `@/lib/database` - 本地索引存储
- `@/lib/crypto` - 加密操作

## 设计原则

- **可靠性**: 断点续传支持
- **隐私性**: 支持端到端加密
- **延迟**: 异步批处理优化
- **兼容性**: 支持多设备同步
