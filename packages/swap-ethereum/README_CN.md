# @aryxn/swap-ethereum

Aryxn 万能路由的以太坊交换 SDK，支持 Uniswap V2/V3、Aerodrome 以及多链自动路由逻辑。

## 安装

```bash
pnpm add @aryxn/swap-ethereum
```

## 使用方法

### 1. 初始化

```typescript
import { EthereumSwapper, CHAIN_CONFIGS } from "@aryxn/swap-ethereum"

// 轻松获取不同链的 WETH/USDC 地址预设
const baseConfig = CHAIN_CONFIGS.BASE;

const swapper = new EthereumSwapper({
  rpcUrl: "https://base-mainnet.g.alchemy.com/v2/...",
  contractAddress: "0x...", // 部署的 UniversalRouter 地址
})
```

### 2. 执行交换（原生 ETH 交换代币）

```typescript
const tx = await swapper.swap({
  signer: ethSigner,
  tokenIn: EthereumSwapper.NATIVE_ETH, // 使用 NATIVE_ETH 常量进行原生 ETH 交换
  tokenOut: CHAIN_CONFIGS.BASE.USDC,
  amountIn: parseEther("1"),
  minAmountOut: 0n,
  deadline: Math.floor(Date.now() / 1000) + 600,
  protection: ProtectionLevel.MEDIUM, // 默认为 MEDIUM 中等保护
  exactApproval: true, // 对于 ERC20 仅授权所需金额，提升安全性
})
```

### 3. 查看统计信息

```typescript
const stats = await swapper.getStats()
console.log("总交易量:", stats.totalVolume)
```

## 特性

- **多链原生支持**：内置 Base, Arbitrum, Ethereum 的配置预设。
- **原生 ETH 集成**：无缝处理 ETH <-> Token 交换，无需手动 wrap。
- **链上自动寻路**：利用合约 `PathFinder` 模块在所有已注册 DEX 中寻找最优路径。
- **MEV 保护**：内置 Chainlink 预言机价格验证（基础、中等、高等保护等级）。

## 许可证

MIT
