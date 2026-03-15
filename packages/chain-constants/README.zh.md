# @alixex/chain-constants

Aryxn 多链应用的共享链常量和工具函数。为链标识符、链 ID、浏览器 URL 和链相关元数据提供单一真相源。

[English Documentation](./README.md)

## 特性

- ✨ **类型安全的链标识符** - 基于枚举的链常量防止拼写错误
- 🔗 **多链支持** - Ethereum、Solana、Bitcoin、Arweave、Sui 等
- 🌐 **浏览器 URL 构建器** - 自动生成交易浏览器链接
- 📋 **精选链列表** - 为常见用例预定义的链列表（同步、账户、余额）
- 🔢 **链 ID 映射** - 链名称 ↔ ID 的双向转换

## 安装

```bash
pnpm add @alixex/chain-constants
```

## 快速开始

```typescript
import {
  Chains,
  ChainIds,
  getExplorerTxUrl,
  AccountChains,
} from "@alixex/chain-constants"

// 使用类型安全的链常量
if (userChain === Chains.ETHEREUM) {
  console.log("用户在以太坊上")
}

// 获取链 ID
const ethChainId = ChainIds.ETHEREUM // 1

// 生成浏览器 URL
const txUrl = getExplorerTxUrl(Chains.ETHEREUM, "0xabc...")
// => "https://etherscan.io/tx/0xabc..."

// 遍历支持的链
AccountChains.forEach((chain) => {
  console.log(`支持 ${chain}`)
})
```

## API 参考

### 链常量

#### `Chains`

支持的区块链标识符的类型安全枚举：

```typescript
export const Chains = {
  ETHEREUM: "ethereum",
  SOLANA: "solana",
  BITCOIN: "bitcoin",
  ARWEAVE: "arweave",
  SUI: "sui",
} as const
```

**用法：**

```typescript
import { Chains } from "@alixex/chain-constants"

// ✅ 类型安全
const chain = Chains.ETHEREUM

// ❌ 避免硬编码字符串
const chain = "ethereum" // 容易拼写错误
```

#### `ChainIds`

EVM 和其他链的数字链 ID：

```typescript
export const ChainIds = {
  ETHEREUM: 1,
  POLYGON: 137,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  BSC: 56,
  AVALANCHE: 43114,
  BASE: 8453,
  SOLANA: 1151111081099710,
  // ... 更多
} as const
```

#### `EvmChainIds`

所有 EVM 兼容链 ID 的数组：

```typescript
import { EvmChainIds } from "@alixex/chain-constants"

const isEvm = EvmChainIds.includes(chainId)
```

### 链列表

为常见用例预配置的数组：

#### `AccountChains`

支持账户/钱包管理的链：

```typescript
export const AccountChains = [
  Chains.ETHEREUM,
  Chains.BITCOIN,
  Chains.SOLANA,
  Chains.SUI,
  Chains.ARWEAVE,
] as const
```

#### `TokenBalanceChains`

支持代币余额查询的链：

```typescript
export const TokenBalanceChains = [
  Chains.ETHEREUM,
  Chains.SOLANA,
  Chains.SUI,
] as const
```

#### `AppSyncChains`

支持应用数据同步的链：

```typescript
export const AppSyncChains = [
  Chains.ETHEREUM,
  Chains.SOLANA,
  Chains.BITCOIN,
  Chains.ARWEAVE,
  Chains.SUI,
] as const
```

### 链映射

#### `ChainNameToId`

将链名称（含别名）映射到数字 ID：

```typescript
import { ChainNameToId } from "@alixex/chain-constants"

ChainNameToId.ethereum // 1
ChainNameToId.eth // 1 (别名)
ChainNameToId.polygon // 137
ChainNameToId.matic // 137 (别名)
```

#### `ChainIdToName`

从链 ID 到显示名称的反向映射：

```typescript
import { ChainIdToName } from "@alixex/chain-constants"

ChainIdToName[1] // "Ethereum"
ChainIdToName[137] // "Polygon"
```

### 浏览器工具

#### `getExplorerTxUrl(chain, txHash)`

为交易生成区块链浏览器 URL：

```typescript
import { getExplorerTxUrl, Chains } from "@alixex/chain-constants"

const url = getExplorerTxUrl(Chains.ETHEREUM, "0xabc123...")
// => "https://etherscan.io/tx/0xabc123..."

getExplorerTxUrl(Chains.SOLANA, "abc123...")
// => "https://solscan.io/tx/abc123..."

getExplorerTxUrl(Chains.ARWEAVE, "abc123...")
// => "https://arweave.net/tx/abc123..."

// 未知链回退到 Blockchair
getExplorerTxUrl("unknown", "abc123")
// => "https://blockchair.com/search?q=abc123"
```

#### `isKnownExplorerChain(chain)`

检查链是否有已知的浏览器 URL：

```typescript
import { isKnownExplorerChain } from "@alixex/chain-constants"

isKnownExplorerChain("ethereum") // true
isKnownExplorerChain("solana") // true
isKnownExplorerChain("unknown") // false
```

#### `ExplorerTxBaseByChain`

原始浏览器基础 URL 映射：

```typescript
export const ExplorerTxBaseByChain = {
  ethereum: "https://etherscan.io/tx/",
  solana: "https://solscan.io/tx/",
  bitcoin: "https://mempool.space/tx/",
  arweave: "https://arweave.net/tx/",
  sui: "https://suiscan.xyz/mainnet/tx/",
  // ... 包含别名 (eth, sol, btc, ar)
} as const
```

## TypeScript 类型

```typescript
import type { ChainType } from "@alixex/chain-constants"

// ChainType = "ethereum" | "solana" | "bitcoin" | "arweave" | "sui"
const chain: ChainType = Chains.ETHEREUM
```

## 最佳实践

### ✅ 推荐：使用 Chains 枚举的处理器映射

```typescript
import { Chains } from "@alixex/chain-constants"

const chainHandlers = {
  [Chains.ETHEREUM]: () => handleEthereum(),
  [Chains.SOLANA]: () => handleSolana(),
  [Chains.ARWEAVE]: () => handleArweave(),
}

const handler = chainHandlers[chain]
if (handler) handler()
```

### ❌ 不推荐：使用硬编码的 if/else 链

```typescript
// 避免这种模式
if (chain === "ethereum") {
  // ...
} else if (chain === "solana") {
  // ...
}
```

### ✅ 推荐：导入特定常量

```typescript
import { Chains, AccountChains, getExplorerTxUrl } from "@alixex/chain-constants"
```

### ❌ 不推荐：重复定义链数组

```typescript
// 避免在应用中重复定义这些
const supportedChains = ["ethereum", "solana", "sui"] // 应使用 AccountChains
```

## 包结构

```
packages/chain-constants/
├── src/
│   ├── index.ts         # 统一导出
│   └── chains.ts        # 所有常量和工具函数
├── package.json
├── README.md
├── README.zh.md
└── tsconfig.json
```

## 许可证

AGPL-3.0-or-later

## 相关包

- [@alixex/cross-chain](../cross-chain) - 跨链桥接工具
- [@alixex/query-chain](../query-chain) - 多链数据查询
- [@alixex/wallet-core](../wallet-core) - 多链钱包管理

---

用 ❤️ 为 Aryxn 生态系统构建
