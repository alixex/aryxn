# @aryxn/sdk-history

A unified multi-chain transaction history indexer for Aryxn applications.

This package provides a standardized interface to fetch transaction history from major blockchain networks using official or industry-standard public APIs. It is designed to be lightweight, non-blocking, and easy to integrate into frontend applications.

## Features

- **Multi-Chain Support**: unified `ChainRecord` interface for Arweave, Bitcoin, Ethereum (EVM), Solana, and Sui.
- **Incremental Sync**: Fetches records in pages and streams them to the UI via callbacks.
- **Non-Blocking**: Utilizes `requestIdleCallback` (where available) to process data during browser idle time, ensuring smooth UI performance.
- **Optimization**:
  - **Address Validation**: Automatically skips invalid chains for a given address.
  - **Standardized Types**: Normalized transaction types (`SEND`, `RECEIVE`, `SWAP`, `BRIDGE`).

## Supported Chains & APIs

| Chain        | Adapter          | API Source                                           |
| :----------- | :--------------- | :--------------------------------------------------- |
| **Arweave**  | `ArweaveAdapter` | official Gateway (`arweave.net/graphql`)             |
| **Bitcoin**  | `BitcoinAdapter` | Mempool.space API                                    |
| **Ethereum** | `EVMAdapter`     | Blockscout V2 API                                    |
| **Solana**   | `SolanaAdapter`  | Official Mainnet RPC (`api.mainnet-beta.solana.com`) |
| **Sui**      | `SuiAdapter`     | Official Mainnet RPC (`fullnode.mainnet.sui.io`)     |

## Installation

```bash
pnpm add @aryxn/sdk-history
```

## Usage

```typescript
import { AggregateHistoryProvider, ChainRecord } from "@aryxn/sdk-history"

// Initialize the provider
// Note: EVM RPC URL can be provided but currently uses Blockscout API directly
const provider = new AggregateHistoryProvider("https://eth.llamarpc.com")

// Start syncing history for a specific chain
// The callback will be invoked for each discovered record
await provider.startSync(
  "ethereum", // chain identifier
  "0xYourWalletAddress...", // wallet address
  (record: ChainRecord) => {
    console.log("New Transaction:", record)
    // Update your UI or Store here
  },
)
```

### Rate Limiting & caching

The `AggregateHistoryProvider` implements a basic in-memory rate limiter to prevent spamming APIs. If `startSync` is called for the same `chain:address` pair within 1 minute, it will be skipped unless the `force` parameter is set to true.

### Data Structure

```typescript
export interface ChainRecord {
  id: string // Transaction Hash / ID
  chain: ChainType // "ethereum" | "solana" | "bitcoin" | "arweave" | "sui"
  type: TransactionType // "SEND" | "RECEIVE" | ...
  status: TransactionStatus // "COMPLETED" | "PENDING" | "FAILED"
  from: string
  to: string
  amount: string // Human-readable amount (e.g. "1.5")
  token: string // Token Symbol (e.g. "ETH", "SOL")
  timestamp: number // Unix timestamp (ms)
  fee?: string
  memo?: string
}
```

## License

AGPL-3.0-or-later
