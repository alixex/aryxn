# Arweave Storage Operations

与 Arweave 存储交互的核心功能，包括文件上传和搜索。

## 目录结构

```
storage/
├── storage.ts                 # Arweave 上传和操作
├── arweave-search.ts          # 文件搜索和查询
├── index.ts                   # 统一导出
└── README.md                  # 本文件
```

## 核心模块

### `storage.ts`

Arweave 文件上传和存储操作。

```typescript
import {
  uploadToArweave,
  uploadFile,
  generateArweaveWallet,
  estimateArweaveFee,
  arweave,
} from "@/lib/storage"

// 上传文件
const txId = await uploadToArweave(file, wallet)

// 估计费用
const fee = await estimateArweaveFee(fileSize)

// Arweave 客户端实例
const txStatus = arweave.transactions.getStatus(txId)
```

### `arweave-search.ts`

在 Arweave 上搜索和查询文件。

```typescript
import {
  searchArweaveFiles,
  getFileMetadata,
  queryArweave,
} from "@/lib/storage"

// 按所有者搜索
const files = await searchArweaveFiles({
  owner: userAddress,
  tags: ["upload"],
})

// 获取文件元数据
const metadata = await getFileMetadata(txId)

// 自定义 GraphQL 查询
const results = await queryArweave(query)
```

## 使用示例

### 场景 1: 上传文件到 Arweave

```typescript
import { uploadToArweave } from "@/lib/storage"

const file = new File(["content"], "document.pdf")
const wallet = await loadWallet()

const txId = await uploadToArweave(file, wallet, {
  encrypt: true,
  compress: false,
  tags: { app: "aryxn", type: "document" },
})

console.log(`文件已上传，存储 ID: ${txId}`)
```

### 场景 2: 估算上传费用

```typescript
import { estimateArweaveFee } from "@/lib/storage"

const fileSizeBytes = 10 * 1024 * 1024 // 10 MB

const feeAR = await estimateArweaveFee(fileSizeBytes)
console.log(`预计费用: ${feeAR} AR`)
```

### 场景 3: 搜索用户文件

```typescript
import { searchArweaveFiles } from "@/lib/storage"

const myFiles = await searchArweaveFiles({
  owner: userAddress,
  limit: 100,
  sort: "DESC",
})

myFiles.forEach((file) => {
  console.log(`${file.id} - ${file.data_size} 字节`)
})
```

### 场景 4: 获取文件元数据

```typescript
import { getFileMetadata } from "@/lib/storage"

const metadata = await getFileMetadata(txId)

console.log(`已确认: ${metadata.confirmed}`)
console.log(`区块高度: ${metadata.block_height}`)
```

### 场景 5: 自定义 GraphQL 查询

```typescript
import { queryArweave } from "@/lib/storage"

const query = `
  query {
    transactions(
      first: 10
      tags: [
        { name: "App-Name", values: ["aryxn"] }
        { name: "Content-Type", values: ["application/pdf"] }
      ]
    ) {
      edges {
        node {
          id
          owner { address }
          block { timestamp }
        }
      }
    }
  }
`

const results = await queryArweave(query)
```

## 数据结构

### 上传选项

```typescript
interface UploadOptions {
  encrypt?: boolean // 是否加密
  compress?: boolean // 是否压缩
  tags?: Record<string, string> // 自定义标签
  metadata?: Record<string, any> // 元数据
}
```

### 搜索结果

```typescript
interface ArweaveFile {
  id: string // 存储 ID
  owner: string // 所有者地址
  data_size: number // 文件大小
  timestamp: number // 上传时间
  block_height: number // 确认区块高度
  tags: Record<string, string> // 标签
}
```

### 交易状态

```typescript
interface TransactionStatus {
  block_height: number // -1 表示未确认
  block_indep_hash: string
  number_of_confirmations: number
}
```

## 工作流程

### 上传流程

```
准备文件
  ↓
检查 Arweave 余额
  ↓
估算费用
  ↓
加密（可选）
  ↓
压缩（可选）
  ↓
上传到 Arweave
  ↓
获取存储 ID
  ↓
等待确认（约 10-30 分钟）
  ↓
验证上传成功
```

### 费用计算

```typescript
// Arweave 费用 = 数据大小 × 价格（$0.00000001/字节，约）
// 实例：
// 1 MB = ~0.01 AR
// 10 MB = ~0.1 AR
// 100 MB = ~1 AR
```

## API 参考

### `uploadToArweave(file, wallet, options?)`

上传文件到 Arweave。

```typescript
const txId = await uploadToArweave(file, wallet, {
  encrypt: true,
  tags: { category: "document" },
})
// => transaction ID
```

### `estimateArweaveFee(fileSizeBytes)`

估算上传费用。

```typescript
const feeAR = await estimateArweaveFee(1024 * 1024)
// => 0.00... (AR 金额)
```

### `searchArweaveFiles(options)`

搜索 Arweave 上的文件。

```typescript
const files = await searchArweaveFiles({
  owner: address,
  tags: { app: "aryxn" },
  limit: 50,
})
// => ArweaveFile[]
```

### `getFileMetadata(txId)`

获取交易元数据。

```typescript
const meta = await getFileMetadata(txId)
// => TransactionStatus
```

### `queryArweave(graphqlQuery)`

执行自定义 GraphQL 查询。

```typescript
const results = await queryArweave(query)
// => GraphQL 响应
```

### `arweave` 实例

直接访问 Arweave 客户端。

```typescript
import { arweave } from "@/lib/storage"

const balance = await arweave.wallets.getBalance(address)
const txStatus = await arweave.transactions.getStatus(txId)
```

## 成本优化

💡 **建议**

```typescript
// 1. 压缩大型文件
await uploadToArweave(largeFile, wallet, { compress: true })

// 2. 批量上传以降低每个文件的成本
const files = [file1, file2, file3]
const txIds = await Promise.all(files.map((f) => uploadToArweave(f, wallet)))

// 3. 缓存搜索结果
const cachedResults = new Map()

// 4. 检查余额后再上传
const balance = await arweave.wallets.getBalance(wallet.address)
if (balance < estimatedFee) {
  throw new Error("AR 余额不足")
}
```

## 错误处理

```typescript
import { uploadToArweave } from "@/lib/storage"

try {
  const txId = await uploadToArweave(file, wallet)
} catch (error) {
  if (error.message.includes("余额不足")) {
    // 处理余额不足
  } else if (error.message.includes("网络")) {
    // 处理网络错误
  } else {
    console.error("上传失败:", error)
  }
}
```

## 依赖关系

- `arweave` - Arweave JavaScript SDK
- `@/lib/utils` - 压缩工具
- `@/lib/crypto` - 加密工具

## 设计原则

- **不可变性**: 上传后无法修改（Arweave 特性）
- **永久性**: 文件一旦存储就永远存在
- **透明性**: 所有费用都提前计算
- **可靠性**: 自动重试失败的上传
