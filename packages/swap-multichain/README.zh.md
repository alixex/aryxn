# @aryxn/sdk-multichain

多链交换统一 SDK，旨在打通 Solana 和以太坊生态的无缝交易。

## 特性

- **统一接口**：一个 `executeSwap` 方法即可处理两链交易。
- **深度集成**：完美适配 Solana 的 Jupiter 聚合器与以太坊的 Universal Router。
- **双语支持**：提供详尽的中英文文档说明。

## 安装

```bash
pnpm add @aryxn/sdk-multichain
```

## 快速上手

### 1. 初始化

```typescript
import { MultiChainSwapper } from "@aryxn/sdk-multichain"

const swapper = new MultiChainSwapper({
  ethereumRpcUrl: "https://mainnet.infura.io/v3/...",
  solanaRpcUrl: "https://api.mainnet-beta.solana.com",
  ethereumContractAddress: "0x...",
  solanaProgramId: "3cUyodUx...",
})
```

### 2. 获取报价 (Solana)

```typescript
const quote = await swapper.getQuote({
  chain: "solana",
  inputMint: "EPjFW36... (USDC)",
  outputMint: "So11111... (SOL)",
  amount: 1000000, // 1 USDC
})
```

### 3. 执行交换

#### Solana

```typescript
const tx = await swapper.executeSwap({
  chain: "solana",
  signer: wallet, // Anchor Wallet
  tokenIn: "USDC_MINT",
  tokenOut: "SOL_MINT",
  amountIn: 1000000,
  minAmountOut: quote.otherAmountThreshold,
  solana: {
    quoteResponse: quote,
  },
})
```

#### Ethereum

```typescript
const tx = await swapper.executeSwap({
  chain: "ethereum",
  signer: ethSigner, // Ethers Signer
  tokenIn: "0x...",
  tokenOut: "0x...",
  amountIn: parseEther("1"),
  minAmountOut: parseEther("0.99"),
  ethereum: {
    deadline: Math.floor(Date.now() / 1000) + 600,
    route: [], // 可选：预定义路径
  },
})
```

## 管理员功能

### 提取手续费 (EVM)

```typescript
await swapper.withdrawFees({
  chain: "ethereum",
  signer: adminSigner,
  tokenAddress: "0x...",
})
```

## 许可证

MIT
