# @aryxn/sdk-ethereum

Aryxn 万能路由的以太坊交换 SDK，支持 Uniswap V2/V3 和多跳路由逻辑。

## 安装

```bash
pnpm add @aryxn/sdk-ethereum
```

## 使用方法

### 1. 初始化

```typescript
import { EthereumSwapper } from "@aryxn/sdk-ethereum"

const swapper = new EthereumSwapper({
  rpcUrl: "https://mainnet.infura.io/v3/...",
  contractAddress: "0x...",
})
```

### 2. 查看统计信息

```typescript
const stats = await swapper.getStats()
console.log("总交易量:", stats.totalVolume)
```

### 3. 执行交换

```typescript
const tx = await swapper.swap({
  signer: ethSigner,
  tokenIn: "0x...",
  tokenOut: "0x...",
  amountIn: parseUnits("1", 18),
  minAmountOut: parseUnits("0.99", 18),
  deadline: Math.floor(Date.now() / 1000) + 600,
  route: [], // 由 PathFinder 生成的路径
  protection: ProtectionLevel.MEDIUM,
})
```

## 特性

- **多跳路由支持**：利用 `PathFinder` 模块进行最优路径寻找。
- **MEV 保护**：支持不同的保护等级（基础、中等、高等）。
- **简易费用管理**：提供后台费用提取和配置的简单接口。

## 许可证

MIT
