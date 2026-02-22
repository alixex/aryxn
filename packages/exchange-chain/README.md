# @aryxn/exchange-chain

Unified Exchange SDK for Swap and Bridge operations across multiple chains.

## Overview

`@aryxn/exchange-chain` provides a high-level router that intelligently selects between simple swaps (on the same chain) and cross-chain bridges. It integrates with `@aryxn/swap-multichain` for DEX operations and `@aryxn/cross-chain` for bridging services (via LiFi).

## Features

- **Unified Interface**: Single API for both swaps and bridges.
- **Multi-Chain Support**: Support for EVM, Solana, Bitcoin, and Arweave.
- **Route Optimization**: Automatically determines whether a swap or a bridge is required.
- **History Tracking**: Integrated transaction history via `@aryxn/query-chain`.

## Installation

```bash
npm install @aryxn/exchange-chain
# or
yarn add @aryxn/exchange-chain
# or
pnpm add @aryxn/exchange-chain
```

## Dependency Requirements

This package depends on several other `@aryxn` workspace packages:

- `@aryxn/chain-constants`
- `@aryxn/cross-chain`
- `@aryxn/query-chain`
- `@aryxn/swap-multichain`
- `@aryxn/wallet-core`

## Usage

### Basic Example

```typescript
import { ExchangeSDK } from "@aryxn/exchange-chain"

const sdk = new ExchangeSDK({
  ethereumContractAddress: "0x...",
  solanaProgramId: "...",
  supportedChains: ["ETHEREUM", "SOLANA", "BITCOIN"],
  bridgedChains: ["BITCOIN"], // Force bridge for Bitcoin even if on same chain
  rpcUrls: {
    ETHEREUM: "https://mainnet.infura.io/v3/...",
    SOLANA: "https://api.mainnet-beta.solana.com",
  },
  tokenMappings: {
    // Optional custom token resolution
    ETHEREUM: { ETH: "0x..." },
  },
})

// Get a route for an exchange
const route = await sdk.router.getRoute({
  fromChain: "ETHEREUM",
  toChain: "SOLANA",
  fromToken: "USDC",
  toToken: "native",
  fromAmount: "1000000", // 1 USDC (6 decimals)
  recipient: "...",
})

if (route) {
  console.log(`Estimated output: ${route.toAmount}`)
  console.log(`Type: ${route.type}`) // 'SWAP' or 'BRIDGE'
}
```

## API Reference

### `ExchangeSDK`

The main entry point for the SDK.

- `constructor(config: ExchangeConfig)`: Initializes the SDK with configuration.
- `router`: An instance of `ExchangeRouter` for routing operations.
- `history`: An instance of `AggregateHistoryProvider` for querying transaction history.

### `ExchangeRouter`

Handles route discovery and optimization.

- `getRoute(request: ExchangeRequest)`: Returns the best route for the given request.

## License

MIT
