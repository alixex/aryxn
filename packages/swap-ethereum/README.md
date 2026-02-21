# @aryxn/swap-ethereum

Ethereum Swapper SDK for the Aryxn Universal Router, supporting Uniswap V2/V3, Aerodrome, and multi-chain routing.

## Installation

```bash
pnpm add @aryxn/swap-ethereum
```

## Usage

### 1. Initialize

```typescript
import { EthereumSwapper, CHAIN_CONFIGS } from "@aryxn/swap-ethereum"

// Easily get WETH/USDC addresses for different chains
const baseConfig = CHAIN_CONFIGS.BASE;

const swapper = new EthereumSwapper({
  rpcUrl: "https://base-mainnet.g.alchemy.com/v2/...",
  contractAddress: "0x...", // Your UniversalRouter deployment
})
```

### 2. Execute Swap (Native ETH to Token)

```typescript
const tx = await swapper.swap({
  signer: ethSigner,
  tokenIn: EthereumSwapper.NATIVE_ETH, // Use NATIVE_ETH for direct ETH swaps
  tokenOut: CHAIN_CONFIGS.BASE.USDC,
  amountIn: parseEther("1"),
  minAmountOut: 0n,
  deadline: Math.floor(Date.now() / 1000) + 600,
  protection: ProtectionLevel.MEDIUM, // Defaults to MEDIUM
  exactApproval: true, // Only approve required amount for ERC20s
})
```

### 3. Check Stats

```typescript
const stats = await swapper.getStats()
console.log("Total Volume:", stats.totalVolume)
```

## Features

- **Multi-Chain Native Support**: Built-in configs for Base, Arbitrum, and Ethereum.
- **Native ETH Integration**: Seamlessly handles ETH <-> Token swaps without manual wrapping.
- **On-Chain PathFinding**: Leverages the `PathFinder` module for optimal routing across all registered DEXs.
- **MEV Protection**: Built-in validation against Chainlink oracles (BASIC, MEDIUM, HIGH).

## License

MIT
