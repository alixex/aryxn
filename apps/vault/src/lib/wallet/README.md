# Wallet Management

钱包和金库管理，包括导出、导入和配置管理。

## 目录结构

```
wallet/
├── wallet-export.ts           # 钱包导出和备份
├── vault-export.ts            # 金库导出/导入
├── config-import-export.ts     # 配置导入/导出
├── index.ts                   # 统一导出
└── README.md                  # 本文件
```

## 核心模块

### `wallet-export.ts`

导出单个钱包的私钥和元数据。

```typescript
import { exportWallet } from "@/lib/wallet"

const exported = await exportWallet(walletAddress, masterKey)
// => { privateKey, mnemonic, wallet, metadata }
```

### `vault-export.ts`

导出/导入整个金库用于跨设备同步。

```typescript
import { exportVault, importVault } from "@/lib/wallet"

// 导出
const vaultData = await exportVault(vaultId, masterKey)

// 导入
await importVault(vaultData, masterKey)
```

### `config-import-export.ts`

配置和设置的导入导出。

```typescript
import { exportConfig, importConfig } from "@/lib/wallet"

// 导出配置
const config = await exportConfig(userId)

// 导入配置
await importConfig(config)
```

## 使用示例

### 场景 1: 导出单个钱包备份

```typescript
import { exportWallet } from "@/lib/wallet"

async function exportWalletBackup(address, password) {
  const masterKey = await deriveKeyFromPassword(password)

  const backup = await exportWallet(address, masterKey)

  // 以 JSON 格式保存
  const json = JSON.stringify(backup, null, 2)
  downloadFile(json, `wallet-${address}.json`)
}
```

### 场景 2: 导入钱包

```typescript
import { importWallet } from "@/lib/wallet"

async function importWalletFromFile(file, masterKey) {
  const text = await file.text()
  const walletData = JSON.parse(text)

  await importWallet(walletData, masterKey)
}
```

### 场景 3: 完整金库备份

```typescript
import { exportVault, encryptData, toBase64 } from "@/lib/wallet"

async function backupVault(vaultId, masterKey) {
  // 导出金库
  const vaultData = await exportVault(vaultId, masterKey)

  // 二次加密
  const { ciphertext, nonce } = await encryptData(
    toBytes(JSON.stringify(vaultData)),
    masterKey,
  )

  // 保存备份
  const backup = {
    timestamp: Date.now(),
    version: "1.0.0",
    encrypted: true,
    data: toBase64(ciphertext),
    nonce: toBase64(nonce),
  }

  localStorage.setItem("vault_backup", JSON.stringify(backup))
}
```

### 场景 4: 恢复金库

```typescript
import { importVault, decryptData, fromBase64, fromBytes } from "@/lib/wallet"

async function restoreVault(masterKey) {
  const backupStr = localStorage.getItem("vault_backup")
  const backup = JSON.parse(backupStr)

  // 解密
  const decrypted = await decryptData(
    fromBase64(backup.data),
    fromBase64(backup.nonce),
    masterKey,
  )

  const vaultData = JSON.parse(fromBytes(decrypted))

  // 导入
  await importVault(vaultData, masterKey)
}
```

### 场景 5: 配置同步

```typescript
import { exportConfig, importConfig } from "@/lib/wallet"

// 设备 A: 导出配置
async function syncConfigToCloud(userId, token) {
  const config = await exportConfig(userId)

  // 上传到服务器
  const response = await fetch("/api/sync/config", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(config),
  })

  return response.json()
}

// 设备 B: 导入配置
async function syncConfigFromCloud(userId, token) {
  const response = await fetch("/api/sync/config", {
    headers: { Authorization: `Bearer ${token}` },
  })

  const config = await response.json()
  await importConfig(config)
}
```

## 数据结构

### 导出的钱包

```typescript
interface ExportedWallet {
  address: string // 钱包地址
  chain: string // 所在链
  alias: string // 钱包别名
  privateKey?: string // 私钥（加密后）
  mnemonic?: string // 助记词（加密后）
  metadata: {
    createdAt: number // 创建时间
    version: string // 钱包版本
    encryptionAlgo: string // 加密算法
  }
}
```

### 导出的金库

```typescript
interface VaultExportData {
  version: string // 导出版本
  exportDate: number // 导出时间
  wallets: WalletRecord[] // 所有钱包
  vaultMetadata: VaultMetadata[] // 金库元数据
  settings: {
    language: string
    theme: string
    notifications: boolean
  }
}
```

### 配置

```typescript
interface Config {
  userId: string
  settings: Record<string, any>
  preferences: {
    theme: "light" | "dark"
    language: string
    autoLock: number // 分钟
  }
  syncTimestamp: number
}
```

## 工作流程

### 金库备份流程

```
用户触发备份
  ↓
验证主密钥
  ↓
导出所有钱包
  ↓
导出设置和元数据
  ↓
二次加密（可选）
  ↓
保存到本地或云端
  ↓
显示确认
```

### 金库恢复流程

```
用户选择备份文件
  ↓
验证文件完整性
  ↓
要求输入主密钥
  ↓
解密数据
  ↓
导入钱包
  ↓
导入设置
  ↓
验证导入成功
  ↓
刷新 UI
```

## API 参考

### `exportWallet(address, masterKey)`

导出单个钱包。

```typescript
const exported = await exportWallet("0x1234...abcd", masterKeyUint8Array)
// => ExportedWallet
```

### `importWallet(data, masterKey)`

导入钱包。

```typescript
await importWallet(exportedWalletData, masterKeyUint8Array)
```

### `exportVault(vaultId, masterKey)`

导出整个金库。

```typescript
const vaultData = await exportVault(vaultId, masterKeyUint8Array)
// => VaultExportData
```

### `importVault(data, masterKey)`

导入金库。

```typescript
await importVault(vaultExportData, masterKeyUint8Array)
```

### `exportConfig(userId)`

导出用户配置。

```typescript
const config = await exportConfig(userId)
// => Config
```

### `importConfig(config)`

导入配置。

```typescript
await importConfig(configData)
```

## 安全考虑

⚠️ **重要**

- **加密**: 所有导出都应加密存储
- **访问控制**: 导出文件应受访问限制
- **验证**: 导入前验证数据来源
- **备份频率**: 定期备份，不少于每周一次
- **多地储存**: 备份应存储在多个位置
- **版本管理**: 保留旧备份用于恢复

## 最佳实践

✅ **推荐**

```typescript
// 1. 使用强密钥导出
const strongKey = await deriveKeyFromPassword(uPassword)
const exported = await exportWallet(address, strongKey)

// 2. 验证导出的数据
if (!exported.address || !exported.privateKey) {
  throw new Error("导出数据不完整")
}

// 3. 加密后备份
const { ciphertext, nonce } = await encryptData(
  toBytes(JSON.stringify(exported)),
  backupKey,
)

// 4. 定期测试恢复
const testRestore = await importWallet(exported, masterKey)

// 5. 版本控制
const backup = {
  version: "1.0.0",
  timestamp: Date.now(),
  data: exported,
}
```

❌ **不推荐**

```typescript
// 未加密导出
const exported = JSON.stringify(walletData)
localStorage.setItem("wallet", exported)

// 忽略错误验证
const data = freeFormUserInput
await importWallet(data, masterKey)

// 单点备份
downloadFile(backup, "vault.json") // 只保存在一个地方

// 未验证恢复
await importWallet(data, key)
// 没有测试是否可以实际恢复
```

## 依赖关系

- `@/lib/crypto` - 加密操作
- `@/lib/database` - 存储操作
- `@/lib/utils` - 类型和工具

## 设计原则

- **安全性**: 敏感数据总是加密的
- **完整性**: 导出包含所有必要信息
- **可恢复**: 能够完全恢复原始状态
- **版本化**: 支持多个备份版本
