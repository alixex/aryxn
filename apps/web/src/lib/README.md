# Lib - Core Utilities and Services

应用的核心工具库，组织为八个功能模块。

## 📚 模块概览

```
lib/
├── chain/           # 多链工具（余额查询、代币配置）
├── crypto/          # 加密和安全（加密/解密、密钥管理）
├── database/        # 数据存储（SQLite、Vault DB）
├── file/            # 文件管理（索引、同步、Manifest）
├── payment/         # 支付和 DEX（代币交换、汇率）
├── storage/         # Arweave 存储（上传、搜索）
├── utils/           # 通用工具（格式化、压缩、类型）
├── wallet/          # 钱包管理（导出/导入、备份恢复）
├── contracts/       # 智能合约（地址、ABI、代币配置）
└── README.md        # 本文件
```

## 🎯 模块职责

| 模块         | 职责         | 关键功能                                                |
| ------------ | ------------ | ------------------------------------------------------- |
| **chain**    | 多链支持     | `getBalance()`, `TOKEN_CONFIG`                          |
| **crypto**   | 安全加密     | `encryptData()`, `decryptData()`, `deriveKey()`         |
| **database** | 数据持久化   | `db.run()`, `db.get()`, `db.all()`                      |
| **file**     | 文件管理     | `uploadFile()`, `searchFiles()`, `syncFilesToArweave()` |
| **payment**  | 支付处理     | `convertAmount()`, `getTokenRate()`                     |
| **storage**  | Arweave 操作 | `uploadToArweave()`, `searchArweaveFiles()`             |
| **utils**    | 常见工具     | `cn()`, `formatFileSize()`, `compressData()`            |
| **wallet**   | 钱包备份     | `exportWallet()`, `exportVault()`, `importVault()`      |

## 🔄 模块依赖关系

```
payment/ ──→ dex-hooks
   ↓
 chain/
   ↓
storage/ ←─ file/
   ↓        ↓
database/ ─ wallet/
   ↓
 crypto/
   ↓
utils/ ←─ database/
```

**依赖流向说明：**

- payment 依赖 chain（多链支持）和 dex-hooks（交换）
- file 依赖 storage（Arweave 上传）和 database（本地索引）
- wallet 依赖 crypto（加密）和 database（存储）
- utils 被所有模块使用

## 📖 快速入门

### 导入模块

```typescript
// 按需导入特定功能
import { getBalance } from "@/lib/chain"
import { encryptData, decryptData } from "@/lib/crypto"
import { db } from "@/lib/database"
import { uploadFile, searchFiles } from "@/lib/file"
import { paymentService } from "@/lib/payment"
import { uploadToArweave, searchArweaveFiles } from "@/lib/storage"
import { cn, formatFileSize, compressData } from "@/lib/utils"
import { exportVault, importVault } from "@/lib/wallet"
```

### 常见任务

#### 1. 查询用户余额

```typescript
import { getBalance } from "@/lib/chain"

const balance = await getBalance(userAddress, "ethereum")
console.log(`${balance.formatted}`)
```

#### 2. 加密敏感数据

```typescript
import { encryptData, toBase64 } from "@/lib/crypto"

const encrypted = await encryptData(data, masterKey)
const stored = {
  ciphertext: toBase64(encrypted.ciphertext),
  nonce: toBase64(encrypted.nonce),
}
```

#### 3. 上传文件

```typescript
import { uploadFile } from "@/lib/file"

const fileIndex = await uploadFile(file, {
  owner: userAddress,
  encrypt: true,
})
```

#### 4. 搜索文件

```typescript
import { searchFiles } from "@/lib/file"

const files = await searchFiles("", {
  owner: userAddress,
  limit: 100,
})
```

#### 5. 获取代币汇率

```typescript
import { paymentService } from "@/lib/payment"

const arAmount = await paymentService.convertAmount("USDC", "100", "AR")
```

#### 6. 上传到 Arweave

```typescript
import { uploadToArweave, estimateArweaveFee } from "@/lib/storage"

const fee = await estimateArweaveFee(file.size)
const txId = await uploadToArweave(file, wallet)
```

#### 7. 格式化和压缩

```typescript
import { formatFileSize, compressData, cn } from "@/lib/utils"

const size = formatFileSize(file.size)
const compressed = await compressData(file)
const className = cn("px-4", isActive && "bg-blue")
```

#### 8. 备份和恢复

```typescript
import { exportVault, importVault } from "@/lib/wallet"

const backup = await exportVault(vaultId, masterKey)
await importVault(backup, masterKey)
```

## 📝 模块详解

### 📊 Chain (多链工具)

**用途**: 跨链余额查询和代币配置管理

**支持的链**: Ethereum, Polygon, Solana, Arweave, Bitcoin, SUI

```typescript
import { getBalance, SOLANA_TOKENS } from "@/lib/chain"

const eth = await getBalance(address, "ethereum")
const sol = await getBalance(address, "solana")
```

[详细说明](./chain/README.md)

### 🔐 Crypto (加密安全)

**用途**: 数据加密、密钥派生、安全操作

**算法**: AES-GCM (AEAD)

```typescript
import { encryptData, decryptData, deriveKey } from "@/lib/crypto"

const encrypted = await encryptData(data, key)
const decrypted = await decryptData(encrypted.ciphertext, encrypted.nonce, key)
```

[详细说明](./crypto/README.md)

### 💾 Database (数据存储)

**用途**: SQLite 数据库操作和 Vault 数据管理

**表**: wallets, vaults, file_index, upload_history

```typescript
import { db } from "@/lib/database"

const rows = await db.all("SELECT * FROM wallets WHERE vault_id = ?", [vaultId])
```

[详细说明](./database/README.md)

### 📂 File (文件管理)

**用途**: 文件索引、同步和 Manifest 管理

**功能**: 上传、搜索、同步、差量更新

```typescript
import { uploadFile, searchFiles, syncFilesToArweave } from "@/lib/file"

const file = await uploadFile(fileData, { owner: address })
const results = await searchFiles("", { owner: address })
```

[详细说明](./file/README.md)

### 💳 Payment (支付处理)

**用途**: 多代币支付处理和 DEX 集成

**支持的代币**: AR, ETH, SOL, SUI, BTC, USDC, USDT

```typescript
import { paymentService } from "@/lib/payment"

const converted = await paymentService.convertAmount("USDC", "100", "AR")
```

[详细说明](./payment/README.md)

### 🌐 Storage (Arweave 存储)

**用途**: 与 Arweave 的交互 - 上传、搜索、查询

**特性**: 永久存储、不可变性、分布式

```typescript
import { uploadToArweave, searchArweaveFiles } from "@/lib/storage"

const txId = await uploadToArweave(file, wallet)
const files = await searchArweaveFiles({ owner: address })
```

[详细说明](./storage/README.md)

### 🛠️ Utils (通用工具)

**用途**: 常见工具函数、类型定义、数据处理

**功能**: 格式化、压缩、类名合并、编码转换

```typescript
import { formatFileSize, compressData, cn } from "@/lib/utils"

const size = formatFileSize(1024 * 1024) // "1.0 MB"
const className = cn("px-2", isActive && "bg-blue")
```

[详细说明](./utils/README.md)

### 👛 Wallet (钱包管理)

**用途**: 钱包导出/导入、金库备份恢复、配置同步

**支持**: 跨设备同步、版本控制、加密备份

```typescript
import { exportVault, importVault, exportConfig } from "@/lib/wallet"

const backup = await exportVault(vaultId, masterKey)
await importVault(backup, masterKey)
```

[详细说明](./wallet/README.md)

## 🎨 设计原则

### 1. 模块独立性

- 每个模块有明确的职责
- 模块之间通过标准接口交互
- 可以独立测试和更新

### 2. 类型安全

- 全 TypeScript 编写
- 严格的接口定义
- 编译时类型检查

### 3. 异步优先

- 所有 I/O 操作都是异步的
- 支持并发操作
- Promise-based API

### 4. 错误处理

- 详细的错误消息
- 适当的异常抛出
- 恢复建议

### 5. 文档完善

- 每个模块都有 README
- 代码注释清晰
- 使用示例充分

## 🔍 最佳实践

### ✅ 推荐

```typescript
// 1. 按需导入
import { formatFileSize } from "@/lib/utils"

// 2. 使用 async/await
const data = await db.get(query)

// 3. 错误处理
try {
  await uploadToArweave(file, wallet)
} catch (error) {
  console.error("上传失败：", error)
}

// 4. 类型注解
const balance: BalanceResult = await getBalance(address, chain)

// 5. 缓存热数据
const cachedRates = new Map()
```

### ❌ 避免

```typescript
// 1. 默认导出
import * as lib from "@/lib"

// 2. 同步操作
const data = db.getSync(query)

// 3. 忽略错误
await uploadToArweave(file, wallet)

// 4. 全 any 类型
const balance: any = await getBalance(address, chain)

// 5. 重复请求
for (let i = 0; i < 100; i++) {
  await getBalance(address, chain)
}
```

## 🚀 常见用例

### 用例 1: 完整上传流程

```typescript
import { uploadFile } from "@/lib/file"
import { paymentService } from "@/lib/payment"
import { compressData, formatFileSize } from "@/lib/utils"

async function uploadWithPayment(file, token) {
  // 检查大小
  console.log(`文件大小：${formatFileSize(file.size)}`)

  // 压缩
  const compressed = await compressData(file)

  // 计算费用
  const feeAR = 0.5
  const feeInToken = await paymentService.convertAmount(
    "AR",
    feeAR.toString(),
    token,
  )

  // 上传
  const fileIndex = await uploadFile(compressed, { owner: address })

  return fileIndex
}
```

### 用例 2: 跨设备同步

```typescript
import { exportVault, importVault } from "@/lib/wallet"
import { uploadToArweave, searchArweaveFiles } from "@/lib/storage"

async function syncVaultToArweave(vaultId, masterKey) {
  // 导出金库
  const vault = await exportVault(vaultId, masterKey)

  // 上传到 Arweave
  const txId = await uploadToArweave(vault, wallet)

  // 返回存储 ID 用于其他设备恢复
  return txId
}
```

### 用例 3: 余额查询和监控

```typescript
import { getBalance } from "@/lib/chain"
import { cn } from "@/lib/utils"

async function monitorBalance(address, chain) {
  const balance = await getBalance(address, chain)

  const isLow = parseFloat(balance.balance) < 0.1
  const className = cn("p-4 rounded", isLow && "bg-red-100 text-red-900")

  return { balance, className }
}
```

## 📚 学习顺序

建议按以下顺序学习模块：

1. **utils** - 基础工具函数
2. **crypto** - 加密安全
3. **database** - 数据存储
4. **chain** - 多链支持
5. **wallet** - 钱包管理
6. **file** - 文件管理
7. **storage** - Arweave 操作
8. **payment** - 支付处理

## 🤝 贡献指南

添加新功能时：

1. 确定它属于哪个模块（或创建新模块）
2. 通过 index.ts 导出
3. 在模块 README 中文档
4. 添加 TypeScript 类型
5. 包括使用示例
6. 添加错误处理

## 📞 常见问题

**Q: 如何添加新的多链支持？**  
A: 在 `chain/` 目录中添加新的链配置，并在 index.ts 中导出。

**Q: 如何处理大文件上传？**  
A: 使用 `file/` 中的批量上传 + 压缩 + 分块上传。

**Q: 如何备份钱包？**  
A: 使用 `wallet/exportWallet()` 和二次加密备份。

**Q: 支持哪些加密算法？**  
A: 目前使用 AES-GCM，可扩展为支持其他算法。

---

**最后更新**: 2026-02-16  
**版本**: 1.0.0
