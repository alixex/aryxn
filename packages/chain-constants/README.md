# @aryxn/chain-constants

Shared chain constants and utilities for Aryxn multi-chain applications. Provides single-source-of-truth for chain identifiers, chain IDs, explorer URLs, and chain-related metadata.

[中文文档](./README.zh-CN.md)

## Features

- ✨ **Type-safe chain identifiers** - Enum-based chain constants prevent typos
- 🔗 **Multi-chain support** - Ethereum, Solana, Bitcoin, Arweave, Sui, and more
- 🌐 **Explorer URL builders** - Automatic transaction explorer link generation
- 📋 **Curated chain lists** - Pre-defined lists for common use cases (sync, accounts, balances)
- 🔢 **Chain ID mappings** - Bidirectional chain name ↔ ID conversions

## Installation

```bash
pnpm add @aryxn/chain-constants
```

## Quick Start

```typescript
import {
  Chains,
  ChainIds,
  getExplorerTxUrl,
  AccountChains,
} from "@aryxn/chain-constants"

// Use type-safe chain constants
if (userChain === Chains.ETHEREUM) {
  console.log("User is on Ethereum")
}

// Get chain ID
const ethChainId = ChainIds.ETHEREUM // 1

// Generate explorer URL
const txUrl = getExplorerTxUrl(Chains.ETHEREUM, "0xabc...")
// => "https://etherscan.io/tx/0xabc..."

// Loop through supported chains
AccountChains.forEach((chain) => {
  console.log(`Supporting ${chain}`)
})
```

## API Reference

### Chain Constants

#### `Chains`

Type-safe enum for supported blockchain identifiers:

```typescript
export const Chains = {
  ETHEREUM: "ethereum",
  SOLANA: "solana",
  BITCOIN: "bitcoin",
  ARWEAVE: "arweave",
  SUI: "sui",
} as const
```

**Usage:**

```typescript
import { Chains } from "@aryxn/chain-constants"

// ✅ Type-safe
const chain = Chains.ETHEREUM

// ❌ Avoid hardcoded strings
const chain = "ethereum" // prone to typos
```

#### `ChainIds`

Numeric chain IDs for EVM and other chains:

```typescript
export const ChainIds = {
  ETHEREUM: 1,
  POLYGON: 137,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  BSC: 56,
  AVALANCHE: 43114,
  BASE: 8453,
  SOLANA: 1151111081099710,
  // ... and more
} as const
```

#### `EvmChainIds`

Array of all EVM-compatible chain IDs:

```typescript
import { EvmChainIds } from "@aryxn/chain-constants"

const isEvm = EvmChainIds.includes(chainId)
```

### Chain Lists

Pre-configured arrays for common use cases:

#### `AccountChains`

Chains that support account/wallet management:

```typescript
export const AccountChains = [
  Chains.ETHEREUM,
  Chains.BITCOIN,
  Chains.SOLANA,
  Chains.SUI,
  Chains.ARWEAVE,
] as const
```

#### `TokenBalanceChains`

Chains that support token balance queries:

```typescript
export const TokenBalanceChains = [
  Chains.ETHEREUM,
  Chains.SOLANA,
  Chains.SUI,
] as const
```

#### `AppSyncChains`

Chains that support application data synchronization:

```typescript
export const AppSyncChains = [
  Chains.ETHEREUM,
  Chains.SOLANA,
  Chains.BITCOIN,
  Chains.ARWEAVE,
  Chains.SUI,
] as const
```

### Chain Mappings

#### `ChainNameToId`

Map chain names (with aliases) to numeric IDs:

```typescript
import { ChainNameToId } from "@aryxn/chain-constants"

ChainNameToId.ethereum // 1
ChainNameToId.eth // 1 (alias)
ChainNameToId.polygon // 137
ChainNameToId.matic // 137 (alias)
```

#### `ChainIdToName`

Reverse mapping from chain ID to display name:

```typescript
import { ChainIdToName } from "@aryxn/chain-constants"

ChainIdToName[1] // "Ethereum"
ChainIdToName[137] // "Polygon"
```

### Explorer Utilities

#### `getExplorerTxUrl(chain, txHash)`

Generate blockchain explorer URL for a transaction:

```typescript
import { getExplorerTxUrl, Chains } from "@aryxn/chain-constants"

const url = getExplorerTxUrl(Chains.ETHEREUM, "0xabc123...")
// => "https://etherscan.io/tx/0xabc123..."

getExplorerTxUrl(Chains.SOLANA, "abc123...")
// => "https://solscan.io/tx/abc123..."

getExplorerTxUrl(Chains.ARWEAVE, "abc123...")
// => "https://arweave.net/tx/abc123..."

// Unknown chain falls back to Blockchair
getExplorerTxUrl("unknown", "abc123")
// => "https://blockchair.com/search?q=abc123"
```

#### `isKnownExplorerChain(chain)`

Check if a chain has a known explorer URL:

```typescript
import { isKnownExplorerChain } from "@aryxn/chain-constants"

isKnownExplorerChain("ethereum") // true
isKnownExplorerChain("solana") // true
isKnownExplorerChain("unknown") // false
```

#### `ExplorerTxBaseByChain`

Raw explorer base URL mapping:

```typescript
export const ExplorerTxBaseByChain = {
  ethereum: "https://etherscan.io/tx/",
  solana: "https://solscan.io/tx/",
  bitcoin: "https://mempool.space/tx/",
  arweave: "https://arweave.net/tx/",
  sui: "https://suiscan.xyz/mainnet/tx/",
  // ... with aliases (eth, sol, btc, ar)
} as const
```

## TypeScript Types

```typescript
import type { ChainType } from "@aryxn/chain-constants"

// ChainType = "ethereum" | "solana" | "bitcoin" | "arweave" | "sui"
const chain: ChainType = Chains.ETHEREUM
```

## Best Practices

### ✅ DO: Use handler maps with Chains enum

```typescript
import { Chains } from "@aryxn/chain-constants"

const chainHandlers = {
  [Chains.ETHEREUM]: () => handleEthereum(),
  [Chains.SOLANA]: () => handleSolana(),
  [Chains.ARWEAVE]: () => handleArweave(),
}

const handler = chainHandlers[chain]
if (handler) handler()
```

### ❌ DON'T: Use hardcoded if/else chains

```typescript
// Avoid this pattern
if (chain === "ethereum") {
  // ...
} else if (chain === "solana") {
  // ...
}
```

### ✅ DO: Import specific constants

```typescript
import { Chains, AccountChains, getExplorerTxUrl } from "@aryxn/chain-constants"
```

### ❌ DON'T: Duplicate chain arrays

```typescript
// Avoid duplicating these in your app
const supportedChains = ["ethereum", "solana", "sui"] // Use AccountChains instead
```

## Package Structure

```
packages/chain-constants/
├── src/
│   ├── index.ts         # Barrel export
│   └── chains.ts        # All constants and utilities
├── package.json
├── README.md
├── README.zh-CN.md
└── tsconfig.json
```

## License

AGPL-3.0-or-later

## Related Packages

- [@aryxn/cross-chain](../cross-chain) - Cross-chain bridge utilities
- [@aryxn/query-chain](../query-chain) - Multi-chain data queries
- [@aryxn/wallet-core](../wallet-core) - Multi-chain wallet management

---

Built with ❤️ for the Aryxn ecosystem
