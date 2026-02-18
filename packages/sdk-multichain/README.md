# @aryxn/sdk-multichain

Unified Multichain Swapper SDK for seamless trading across Solana and Ethereum.

## Features

- **Unified Interface**: Single `executeSwap` method for both chains.
- **Deep Integration**: Bridges the gap between Solana's Jupiter Aggregator and Ethereum's Universal Router.
- **Bilingual Support**: Comprehensive documentation in English and Chinese.

## Installation

```bash
pnpm add @aryxn/sdk-multichain
```

## Quick Start

### 1. Initialization

```typescript
import { MultiChainSwapper } from "@aryxn/sdk-multichain";

const swapper = new MultiChainSwapper({
  ethereumRpcUrl: "https://mainnet.infura.io/v3/...",
  solanaRpcUrl: "https://api.mainnet-beta.solana.com",
  ethereumContractAddress: "0x...",
  solanaProgramId: "3cUyodUx..."
});
```

### 2. Get Quotes (Solana)

```typescript
const quote = await swapper.getQuote({
  chain: "solana",
  inputMint: "EPjFW36... (USDC)",
  outputMint: "So11111... (SOL)",
  amount: 1000000 // 1 USDC
});
```

### 3. Execute Swap

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
    quoteResponse: quote
  }
});
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
    route: [] // Optional: pre-defined route
  }
});
```

## Admin Features

### Withdraw Fees (EVM)

```typescript
await swapper.withdrawFees({
  chain: "ethereum",
  signer: adminSigner,
  tokenAddress: "0x..."
});
```

## License

MIT
