# @aryxn/cross-chain

Cross-chain bridge and swap aggregator logic for Aryxn.

This package provides services to bridge assets between different blockchains, allowing users to move assets from unsupported chains or tokens to supported payment tokens (like ETH, SOL, USDC).

## Installation

```bash
pnpm add @aryxn/cross-chain
```

## Usage

```typescript
import { BridgeService } from "@aryxn/cross-chain";
import { MultiChainSwapper } from "@aryxn/swap-multichain";

// Initialize the swapper (dependency)
const swapper = new MultiChainSwapper(...);

// Initialize the bridge service
const bridgeService = new BridgeService(swapper);

// Check if a token needs bridging
if (BridgeService.requiresBridge("SOME_TOKEN")) {
  // Perform bridge
  const result = await bridgeService.bridgeAsset({
    fromToken: "SOME_TOKEN",
    toToken: "ETH",
    amount: "100",
    userAddress: "0x...",
    walletKey: walletKey
  });

  console.log("Bridge Tx:", result.txId);
}
```

## Features

- **Bridge Service**: Handles cross-chain asset transfers.
- **Token Check**: Utility to check if a token requires bridging (`requiresBridge`).
