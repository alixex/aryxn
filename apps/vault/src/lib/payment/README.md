# Payment and Routing Services

上传支付分流、费用估算和 Swap/Bridge 路由服务。

## 目录结构

```
payment/
├── payment-service.ts         # 支付执行与费用估算
├── upload-payment-config.ts   # 上传支付统一配置
├── types.ts                   # 支付类型定义
├── index.ts                   # 统一导出
└── README.md                  # 本文件
```

## 核心模块

### `payment-service.ts`

处理上传支付执行（直付 / Irys / 跳转 Swap / 跳转 Bridge）与费用估算。

```typescript
import { paymentService, type PaymentToken } from "@/lib/payment"

const estimate = await paymentService.estimateFeeInToken(1024 * 1024, "USDC")
console.log(estimate.formatted)
```

## 支持的代币

```typescript
type PaymentToken =
  | "AR" // Arweave
  | "ETH" // Ethereum
  | "SOL" // Solana
  | "V2EX" // V2EX
  | "SUI" // SUI
  | "BTC" // Bitcoin
  | "USDC" // USD Coin
  | "USDT" // Tether
```

## 使用示例

### 场景 1: 代币配置查询（常量包）

```typescript
import { PaymentTokenMetadata } from "@aryxn/chain-constants"

const ethConfig = PaymentTokenMetadata["ETH"]
// => {
//   chain: "ethereum",
//   decimals: 18,
//   symbol: "ETH",
//   coingeckoId: "ethereum"
// }
```

### 场景 2: 上传支付统一配置

```typescript
import {
  getUploadPaymentSupportedChains,
  getUploadSelectableTokens,
} from "@/lib/payment"

const chains = getUploadPaymentSupportedChains()
const tokens = getUploadSelectableTokens()
```

## 代币配置（来源）

`TOKEN_CONFIG` 在 `@/lib/payment` 中导出，但底层数据源来自 `@aryxn/chain-constants` 包的 `PaymentTokenMetadata`，避免多处重复维护。

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
系统执行支付分流判定
  ↓
AR 且来源链为 ARWEAVE → PAID_NATIVE
  ↓
ETH/SOL/USDC 且可走 Irys → PAID_IRYS
  ↓
其他情况 → REQUIRE_SWAP 或 REQUIRE_BRIDGE
  ↓
弹确认提示（提示可能需要重新上传）
  ↓
用户确认后跳转到 Swap 对应页面执行
```

### 费用计算

```typescript
const estimate = await paymentService.estimateFeeInToken(file.size, "USDC")
// => { arAmount, tokenAmount, formatted }
```

## API 参考

### `paymentService.estimateFeeInToken(dataSize, token)`

估算上传数据在指定代币下的支付金额。

```typescript
const fee = await paymentService.estimateFeeInToken(1024 * 1024, "USDC")
// => { arAmount, tokenAmount, formatted }
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
// 先验证支持的代币（数据来源于 @aryxn/chain-constants）
if (!TOKEN_CONFIG[selectedToken]) {
  throw new Error("不支持的代币")
}
```

❌ **不推荐**

```typescript
// 直接使用未验证的代币
paymentService.estimateFeeInToken(fileSize, userInput as any)

// 忽略小数位数差异
const amount = "100" // 不知道精度
```

## 与 Swap/Bridge 的集成

Payment 服务与页面层协作方式：

1. **上传页触发支付判定** - 返回 `PAID_NATIVE / PAID_IRYS / REQUIRE_SWAP / REQUIRE_BRIDGE`
2. **统一确认提示** - 需要跳转时先提示用户确认，并告知可能需要重新上传
3. **Swap 页面承接流程** - 用户在 Swap/Bridge 页面自主选择账户和代币完成操作

## 依赖关系

- `@/hooks/useBridge` - 跨链桥接状态与恢复动作
- `@/lib/chain` - 多链工具
- `@aryxn/chain-constants` - 共享链/代币常量与上传支付配置
- CoinGecko API - 历史汇率数据

## 设计原则

- **原子性**: 支付成功或完全失败
- **透明性**: 显示费用并清晰提示后续需要跳转的动作
- **可靠性**: 上传触发跳转前必须经用户确认
- **安全性**: 价格偏差检查防止滑点
