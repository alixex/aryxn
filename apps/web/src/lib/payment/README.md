# Payment and DEX Services

支付处理和 DEX（去中心化交易所）集成服务。

## 目录结构

```
payment/
├── payment-service.ts         # 支付处理和代币管理
├── index.ts                   # 统一导出
└── README.md                  # 本文件
```

## 核心模块

### `payment-service.ts`

处理多链支付和代币转换。

```typescript
import { paymentService, type PaymentToken } from "@/lib/payment"

// 获取支持的代币
const tokens = paymentService.getSupportedTokens()

// 获取代币汇率
const rate = await paymentService.getTokenRate("USDC", "AR")

// 计算支付金额
const arAmount = await paymentService.convertAmount("USDC", "100", "AR")
```

## 支持的代币

```typescript
type PaymentToken =
  | "AR" // Arweave
  | "ETH" // Ethereum
  | "SOL" // Solana
  | "SUI" // SUI
  | "BTC" // Bitcoin
  | "USDC" // USD Coin
  | "USDT" // Tether
```

## 使用示例

### 场景 1: 获取支持的代币列表

```typescript
import { paymentService } from "@/lib/payment"

const supported = paymentService.getSupportedTokens()
// => ["AR", "ETH", "SOL", "SUI", "BTC", "USDC", "USDT"]

supported.forEach((token) => {
  console.log(`支持 ${token}`)
})
```

### 场景 2: 换汇

```typescript
import { paymentService } from "@/lib/payment"

// 用户有 100 USDC，想转换为 AR
const arAmount = await paymentService.convertAmount("USDC", "100", "AR")
console.log(`100 USDC = ${arAmount} AR`)
```

### 场景 3: 获取汇率

```typescript
import { paymentService } from "@/lib/payment"

const rate = await paymentService.getTokenRate("ETH", "AR")
console.log(`1 ETH = ${rate} AR`)
```

### 场景 4: 代币配置查询

```typescript
import { TOKEN_CONFIG } from "@/lib/payment"

const ethConfig = TOKEN_CONFIG["ETH"]
// => {
//   chain: "ethereum",
//   decimals: 18,
//   symbol: "ETH",
//   coingeckoId: "ethereum"
// }
```

## 代币配置

```typescript
interface TokenConfig {
  chain: string // 所在区块链
  decimals: number // 小数位数
  symbol: string // 代币符号
  coingeckoId: string // CoinGecko API ID
}
```

## 工作流程

### 支付流程

```
用户选择支付代币
  ↓
验证余额充足
  ↓
如果不是 AR，从 DEX 获取汇率
  ↓
显示费用和汇兑金额
  ↓
用户确认
  ↓
执行支付/交换
  ↓
更新账户余额
```

### 费用计算

```typescript
// 上传费用
const uploadFeeAR = 0.5 // AR

// 如果用户支付 USDC
const usdcExchangeRate = await paymentService.getTokenRate("USDC", "AR")
const feeUSDC = uploadFeeAR * usdcExchangeRate
const exchangeFee = feeUSDC * 0.01 // 1% 交换费
const totalUSDC = feeUSDC + exchangeFee
```

## API 参考

### `paymentService.getSupportedTokens()`

获取所有支持的代币。

```typescript
const tokens = await paymentService.getSupportedTokens()
// => PaymentToken[]
```

### `paymentService.getTokenRate(from, to)`

获取两种代币之间的汇率。

```typescript
const rate = await paymentService.getTokenRate("USDC", "AR")
// => 数字比率
```

### `paymentService.convertAmount(from, amount, to)`

转换代币金额。

```typescript
const arAmount = await paymentService.convertAmount("USDC", "100.50", "AR")
// => "12.34"（AR 金额）
```

### `TOKEN_CONFIG`

代币配置常量。

```typescript
import { TOKEN_CONFIG } from "@/lib/payment"

const config = TOKEN_CONFIG[token]
// => TokenConfig
```

## 最佳实践

✅ **推荐**

```typescript
// 先验证支持的代币
if (!TOKEN_CONFIG[selectedToken]) {
  throw new Error("不支持的代币")
}

// 缓存汇率以优化性能
const rates = new Map()
for (const token of supportedTokens) {
  const rate = await paymentService.getTokenRate(token, "AR")
  rates.set(token, rate)
}

// 向用户显示多个代币的费用选项
const fees = await Promise.all(
  supportedTokens.map(async (token) => ({
    token,
    fee: await paymentService.convertAmount("AR", baseFeeAR.toString(), token),
  })),
)
```

❌ **不推荐**

```typescript
// 直接使用未验证的代币
paymentService.convertAmount(userInput, amount, "AR")

// 每次请求都重新获取汇率
for (let i = 0; i < 100; i++) {
  await paymentService.getTokenRate("USDC", "AR") // 太频繁
}

// 忽略小数位数差异
const amount = "100" // 不知道精度
```

## 与 DEX 的集成

Payment 服务自动与 swap-hooks 集成，用于：

1. **多链交换** - 支持 Ethereum、Polygon 等网络
2. **价格查询** - 通过 DEX 当前价格而非固定汇率
3. **自动路由** - 找到最优的交换路径

参考 `@/hooks/swap-hooks` 了解交换详情。

## 依赖关系

- `@/hooks/swap-hooks` - 交换实现
- `@/lib/chain` - 多链工具
- CoinGecko API - 历史汇率数据

## 设计原则

- **原子性**: 支付成功或完全失败
- **透明性**: 显示所有费用和汇率
- **可靠性**: 自动重试失败的交换
- **安全性**: 价格偏差检查防止滑点
