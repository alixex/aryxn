# Chain Utilities

多链环境下的通用工具，包括余额查询和链特定的代币配置。

## 目录结构

```
chain/
├── balance.ts                 # 多链余额查询
├── solana-token-config.ts     # Solana 代币配置
├── sui-token-config.ts        # SUI 代币配置
├── index.ts                   # 统一导出
└── README.md                  # 本文件
```

## 核心模块

### `balance.ts`

提供跨链余额查询功能。

```typescript
import { getBalance, type BalanceResult } from "@/lib/chain"

const balance = await getBalance("ethereum", address)
// => { balance: "1.5", formatted: "1.5 ETH", symbol: "ETH" }
```

**支持的链：**

- Ethereum
- Polygon
- Solana
- Arweave
- Bitcoin (via Blockstream)
- SUI

### `solana-token-config.ts`

Solana 网络的代币配置和实用程序。

```typescript
import { SOLANA_TOKENS, formatSolanaTokenAmount } from "@/lib/chain"

const tokenInfo = SOLANA_TOKENS["EPjFWaJbGqB6mbNbLejFlSjQXfEoe3stabilizr"]
const formatted = formatSolanaTokenAmount(100000000, 6) // "1.0"
```

### `sui-token-config.ts`

SUI 网络的代币配置和实用程序。

```typescript
import { SUI_TOKENS, formatSuiTokenAmount } from "@/lib/chain"

const tokenInfo = SUI_TOKENS["0x2::sui::SUI"]
const formatted = formatSuiTokenAmount("1000000000", 9) // "1.0"
```

## 使用示例

### 获取用户余额

```typescript
import { getBalance } from "@/lib/chain"

const userBalance = await getBalance("ethereum", userAddress)
console.log(`用户有 ${userBalance.formatted}`)
```

### 处理代币精度

```typescript
import { formatSolanaTokenAmount } from "@/lib/chain"

const amount = 1_000_000_000 // 1 billion units
const decimals = 6
const formatted = formatSolanaTokenAmount(amount, decimals)
// => "1000000.0" → 显示适当的精度
```

## API 参考

### `getBalance(chain, address, options?)`

- **参数:**
  - `chain`: 链名称 ("ethereum" | "polygon" | "solana" | "arweave" | "bitcoin" | "sui")
  - `address`: 用户地址
  - `options`: 附加选项 `{ rpcUrl?, tokenAddress?, decimals?, forceRefresh? }`
- **返回:** `Promise<BalanceResult>`

### `BalanceResult`

```typescript
interface BalanceResult {
  balance: string // 原始余额
  formatted: string // 格式化后的余额
  symbol: string // 代币符号
  timestamp?: number // 缓存时间戳
  error?: string // 错误信息
}
```

## 依赖关系

- `@aryxn/wallet-core` - 钱包操作和链交互
- `@/lib/storage` - Arweave 相关工具

## 设计原则

- **多链支持**: 统一的 API 支持不同区块链
- **类型安全**: TypeScript 接口确保类型正确
- **零依赖**: 不依赖外部 RPC 服务配置
- **缓存友好**: 支持结果缓存和批量查询
