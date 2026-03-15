# @aryxn/arweave

Aryxn 的简化版 Arweave 协议封装库，移除了对于特定 Tags (标签) 的硬编码。该包专注于文件上传、交易签名和费用估算，依赖应用层提供具体的元数据标签。

## 功能特性

- **上传**: 处理数据交易的创建、签名，并发布到 Arweave 网络。
- **压缩**: 包含压缩检测工具，并根据压缩后的体积估算费用。
- **费用估算**: 准确计算原始内容和压缩内容的上传成本。
- **搜索**: 提供 Arweave GraphQL 查询能力，支持按标签、内容和应用名称搜索交易。

## API 参考

### 上传与费用管理

| 函数                                   | 说明                                             |
| :------------------------------------- | :----------------------------------------------- |
| `uploadToArweave(data, key, tags)`     | 使用指定标签上传数据到 Arweave。处理签名和发布。 |
| `estimateArweaveFee(size)`             | 估算给定数据大小的交易费用 (Winston)。           |
| `shouldCompressFile(file, threshold?)` | 根据大小和类型判断文件是否应该被压缩。           |
| `compressData(data)`                   | 使用 `fflate` (GZIP) 压缩数据。                  |
| `decompressData(data)`                 | 解压缩 GZIP 数据。                               |

### 搜索与查询

| 函数                               | 说明                      |
| :--------------------------------- | :------------------------ |
| `searchArweaveTransactionsNetwork` | 在 Arweave 网络上搜索交易 |
| `searchAppTransactions`            | 搜索特定应用的交易        |

**类型：**

- `ArweaveSearchResult` - 交易搜索结果及其元数据
- `SearchOptions` - 搜索操作的查询选项

## 使用示例

### 上传与压缩

```typescript
import { uploadToArweave, estimateArweaveFee } from "@aryxn/arweave"

// 估算费用
const fee = await estimateArweaveFee(fileSize)

// 带自定义标签上传
const txId = await uploadToArweave(data, walletKey, [
  { name: "Content-Type", value: "image/png" },
])
```

### 搜索交易

```typescript
import {
  searchArweaveTransactionsNetwork,
  searchAppTransactions,
} from "@aryxn/arweave"

// 搜索特定应用的交易
const arweaveResults = await searchAppTransactions("Aryxn", "文件名", 50)

// 在 Arweave 网络搜索（支持多种策略）
const results = await searchArweaveTransactionsNetwork({
  query: "my-file",
  limit: 20,
  sort: "HEIGHT_DESC",
})

// 结果包含交易详情
results.forEach((tx) => {
  console.log(`交易 ID: ${tx.id}`) // 交易唯一标识
  console.log(`上传者：${tx.owner.address}`) // 上传者钱包地址
  console.log(`标签数：${tx.tags.length}`) // 交易元数据
  console.log(`大小：${tx.data.size}`) // 数据大小（字节）
})
```

### 搜索缓存

搜索结果默认缓存，避免重复的 GraphQL 查询：

```typescript
import {
  searchArweaveTransactionsNetwork,
  getSearchCache,
} from "@aryxn/arweave"

// 使用缓存（默认行为）
const results = await searchArweaveTransactionsNetwork({
  query: "my-file",
  cache: true, // 启用缓存（默认值）
  cacheTtl: 5 * 60 * 1000, // 5 分钟
})

// 绕过缓存获取最新结果
const freshResults = await searchArweaveTransactionsNetwork({
  query: "my-file",
  cache: false,
})

// 查看缓存统计信息
const cache = getSearchCache()
const stats = cache.getStats()
console.log(`缓存大小：${stats.size}/${stats.maxSize}`)

// 清空所有缓存
cache.clear()
```
