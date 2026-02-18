# @aryxn/sdk-ethereum

Ethereum Swapper SDK for the Aryxn Universal Router, supporting Uniswap V2/V3 and multi-hop routing.

## Installation

```bash
pnpm add @aryxn/sdk-ethereum
```

## Usage

### 1. Initialize

```typescript
import { EthereumSwapper } from "@aryxn/sdk-ethereum"

const swapper = new EthereumSwapper({
  rpcUrl: "https://mainnet.infura.io/v3/...",
  contractAddress: "0x...",
})
```

### 2. Check Stats

```typescript
const stats = await swapper.getStats()
console.log("Total Volume:", stats.totalVolume)
```

### 3. Execute Swap

```typescript
const tx = await swapper.swap({
  signer: ethSigner,
  tokenIn: "0x...",
  tokenOut: "0x...",
  amountIn: parseUnits("1", 18),
  minAmountOut: parseUnits("0.99", 18),
  deadline: Math.floor(Date.now() / 1000) + 600,
  route: [], // PathFinder generated route
  protection: ProtectionLevel.MEDIUM,
})
```

## Features

- **Multi-hop Support**: Leverages the `PathFinder` module for optimal routing.
- **MEV Protection**: Supports different protection levels (BASIC, MEDIUM, HIGH).
- **Easy Fee Management**: Simple interface for fee extraction and configuration.

## License

MIT
