# Account Hooks

集中管理所有账户相关的 hooks，包括内部钱包和外部钱包的管理。

## 目录结构

```
account-hooks/
├── use-wallet.ts              # 统一钱包 hook（推荐优先使用）
├── use-internal-wallet.ts     # 内部钱包 hook（访问 vault）
├── use-external-wallets.ts    # 外部钱包 hook（访问浏览器扩展）
├── useAccounts.ts             # 账户列表和余额管理 hook
├── README.md                  # 文档
├── index.ts                   # 统一导出
├── internal-wallet/           # 内部钱包实现细节
│   ├── use-vault.ts           # 钱包库管理
│   ├── use-wallet-storage.ts  # 钱包持久化存储
│   └── use-wallet-ops.ts      # 钱包操作（添加、创建、导入）
└── external-wallet/           # 外部钱包集成
    ├── use-external-wallets.ts # 统一的外部钱包协调
    ├── use-evm-wallets.ts      # EVM 钱包（MetaMask 等）
    ├── use-arweave-wallet.ts   # Arweave 钱包（ArConnect）
    ├── use-solana-wallet.ts    # Solana 钱包（Phantom）
    └── use-sui-wallet.ts       # Sui 钱包
```

## 核心 Hooks 说明

### `useWallet()` (推荐)
统一的钱包接口，提供对内部账户、外部账户、活跃账户的访问，以及账户操作辅助函数。

```typescript
import { useWallet } from "@/hooks/account-hooks"

const wallet = useWallet()
// wallet.active - 活跃账户集合
// wallet.internal - 内部钱包管理
// wallet.external - 外部钱包状态
// wallet.getLocalAccounts(chain) - 获取本地账户
// wallet.getExternalAccounts(chain) - 获取外部账户
// wallet.getAllAccounts(chain) - 获取所有账户
```

### `useInternal()`
直接访问内部钱包（vault）管理接口。

```typescript
import { useInternal } from "@/hooks/account-hooks"

const walletManager = useInternal()
// walletManager.wallets - 钱包列表
// walletManager.isUnlocked - 是否已解锁
// walletManager.activeAddress - 当前活跃地址
// walletManager.unlock(password) - 解锁钱包
// walletManager.addWallet(input, alias) - 添加钱包
```

### `useExternalWallets()`
访问外部钱包（浏览器扩展）状态和操作。

```typescript
import { useExternalWallets } from "@/hooks/account-hooks"

const { external, actions } = useExternalWallets()
// external.isPaymentConnected - EVM 是否已连接
// external.arAddress - ArConnect 地址
// external.solAddress - Phantom 地址
// actions.connect(chain) - 连接钱包
// actions.disconnect(chain) - 断开连接
```

### `useAccounts()`
管理账户列表和余额信息。

```typescript
import { useAccounts } from "@/hooks/account-hooks"

const {
  balances,           // 余额缓存
  loadingBalances,    // 加载状态
  showBalances,       // 显示/隐藏状态
  refreshBalance,     // 刷新单个余额
  getExternalAccounts // 获取外部账户
} = useAccounts()
```

## 使用指南

### 场景 1: 获取所有账户并显示列表
```typescript
const wallet = useWallet()
const allAccounts = wallet.getAllAccounts("ethereum")
```

### 场景 2: 解锁内部钱包并操作
```typescript
const walletManager = useInternal()
await walletManager.unlock(password)
await walletManager.addWallet(privateKey, alias)
```

### 场景 3: 连接/断开外部钱包
```typescript
const { actions } = useExternalWallets()
await actions.connect("ethereum")
await actions.disconnect("ethereum")
```

### 场景 4: 获取和刷新余额
```typescript
const { balances, refreshBalance } = useAccounts()
const balance = balances["ethereum-0x123..."]
await refreshBalance("ethereum", "0x123...")
```

## 迁移指南

旧的导入路径已被弃用，请更新为：

```typescript
// ❌ 旧
import { useWallet } from "@/hooks/use-wallet"
import { useInternal } from "@/hooks/use-internal-wallet"

// ✅ 新
import { useWallet, useInternal } from "@/hooks/account-hooks"
```

## 设计原则

1. **单一职责**: 每个 hook 负责一个独立的功能
2. **分层管理**: 内部/外部钱包分别管理，统一通过 `useWallet()` 暴露
3. **向后兼容**: 原有导入路径会通过 re-export 保持工作（过渡期）
4. **类型安全**: 所有钱包操作都有完整的类型定义
5. **性能优化**: 使用 memoization 避免不必要的重渲染
