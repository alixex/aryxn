# DEX Hooks

分布式交易所（DEX）相关的 hooks。支持多链的 token 交换、授权、余额查询等操作。

## 目录结构

```
dex-hooks/
├── use-dex-swap.ts              # 外部钱包的 DEX 交换 (wagmi)
├── use-dex-swap-internal.ts     # 内部钱包的 DEX 交换 (ethers.js)
├── use-swap-quote.ts            # 获取交换报价
├── use-fee-calculation.ts       # 计算交换费用
├── use-token-approval.ts        # Token 授权管理
├── use-token-balance.ts         # Token 余额查询
├── README.md                    # 文档
└── index.ts                     # 统一导出
```

## 核心 Hooks 说明

### `useMultiHopSwap()` (外部钱包)
使用外部钱包（MetaMask）进行交换，基于 wagmi 和 ethers.js。

```typescript
import { useMultiHopSwap } from "@/hooks/dex-hooks"

const {
  state,           // 当前状态
  quote,           // 交换报价
  inputAmount,     // 输入金额
  setInputAmount,  // 设置输入金额
  executeSwap,     // 执行交换
  estimateGas,     // 估计 gas
} = useMultiHopSwap({
  inputToken: "0x...",
  outputToken: "0x...",
  inputAmount: "100",
})
```

### `useInternalDexSwap()` (内部钱包)
使用内部钱包进行交换，基于 ethers.js 和内部密钥管理。

```typescript
import { useInternalDexSwap } from "@/hooks/dex-hooks"

const {
  state,           // 当前状态
  quote,           // 交换报价
  inputAmount,     // 输入金额
  setInputAmount,  // 设置输入金额
  executeSwap,     // 执行交换
} = useInternalDexSwap({
  inputToken: "0x...",
  outputToken: "0x...",
  inputAmount: "100",
  decimalsIn: 18,
  decimalsOut: 6,
  slippage: 1.0,
})
```

### `useSwapQuote()`
获取交换报价。

```typescript
import { useSwapQuote } from "@/hooks/dex-hooks"

const quote = await useSwapQuote({
  inputToken: "0x...",
  outputToken: "0x...",
  inputAmount: "100",
})
```

### `useFeeCalculation()`
计算交换时的费用。

```typescript
import { useFeeCalculation } from "@/hooks/dex-hooks"

const { protocolFee, lpFee, totalFee } = useFeeCalculation(quote)
```

### `useTokenApproval()`
管理 token 授权。

```typescript
import { useTokenApproval } from "@/hooks/dex-hooks"

const {
  allowance,
  isApproved,
  approveToken,
  revokeApproval,
} = useTokenApproval(tokenAddress, spenderAddress)
```

### `useTokenBalance()`
查询 token 余额。

```typescript
import { useTokenBalance } from "@/hooks/dex-hooks"

const { balance, formatted, loading } = useTokenBalance(
  tokenAddress,
  userAddress
)
```

## 使用指南

### 场景 1: 使用外部钱包进行交换
```typescript
const swap = useMultiHopSwap({
  inputToken: USDC_ADDRESS,
  outputToken: USDT_ADDRESS,
  inputAmount: "100",
})

if (swap.state === SwapState.READY) {
  await swap.executeSwap()
}
```

### 场景 2: 使用内部钱包进行交换
```typescript
const swap = useInternalDexSwap({
  inputToken: USDC_ADDRESS,
  outputToken: USDT_ADDRESS,
  inputAmount: "100",
  decimalsIn: 6,
  decimalsOut: 6,
  slippage: 0.5,
})

if (swap.state === SwapState.READY) {
  await swap.executeSwap()
}
```

### 场景 3: 获取报价和计算费用
```typescript
import { useSwapQuote, useFeeCalculation } from "@/hooks/dex-hooks"

const quote = await useSwapQuote({...})
const fees = useFeeCalculation(quote)

console.log(`Output: ${quote.outputAmount}`)
console.log(`Total Fee: ${fees.totalFee}%`)
```

## 状态机

DEX 交换状态流转：

```
IDLE
  ↓
FETCHING_QUOTE
  ↓
NEEDS_APPROVAL ? APPROVING → READY : READY
  ↓
SWAPPING
  ↓
CONFIRMING
  ↓
SUCCESS or ERROR
```

## 配置

### 支持的链
- Ethereum (主网)
- Polygon
- Arbitrum
- Optimism

### 支持的 Token
见 `@/lib/contracts/token-config`
