# @aryxn/wallet-core

The core wallet logic for Aryxn, providing chain-agnostic primitives for wallet creation, detection, and account management.

**Note**: This package is purely logical and does **not** depend on low-level crypto libraries directly. It delegates all cryptographic operations to `@aryxn/crypto`.

## Features

- **Multi-Chain Support**: Unified interface for Ethereum, Solana, Sui, Bitcoin, and Arweave wallets.
- **Wallet Creation**: Generates wallets from mnemonics or random seeds using `createWallet`.
- **Chain Detection**: Automatically detects chain type from address strings, private keys, or mnemonics via `detectChainAndAddress`.
- **Utilities**: Built-in helper functions for EVM, Solana, and Sui (clients, balances, unit formatting).
- **Type Definitions**: Shared TypeScript interfaces for `WalletRecord`, `ActiveAccount`, and common blockchain types.

## API Reference

### Core Functions

| Function                                         | Description                                                                             |
| :----------------------------------------------- | :-------------------------------------------------------------------------------------- |
| `createWallet(chain, arweaveInstance?)`          | Creates a new wallet for the specified chain (ethereum, solana, sui, bitcoin, arweave). |
| `detectChainAndAddress(input, arweaveInstance?)` | Detects chain type and address from a private key, mnemonic, or address string.         |
| `initArweave(config)`                            | Initializes a custom Arweave client instance.                                           |

### Chain-Specific Utilities

#### Balance Queries (Cross-Chain)

| Chain      | Function                               | Client/Connection Required |
| :--------- | :------------------------------------- | :------------------------- |
| **EVM**    | `getEvmBalance(provider, address)`     | `JsonRpcProvider`          |
| **Solana** | `getSolanaBalance(connection, pubKey)` | `Connection`               |
| **Sui**    | `getSuiBalance(client, address)`       | `SuiClient`                |

#### EVM (Ethereum & L2s)

- `createEvmProvider(url)` / `createEvmWallet(privateKey, provider)`
- `formatEther(wei)` / `parseEther(eth)`
- `formatUnits(value, decimals)` / `parseUnits(value, decimals)`

#### Solana

- `createSolanaConnection(endpoint)` / `createSolanaPublicKey(address)`
- `formatSolanaBalance(lamports)` / `parseSolanaAmount(sol)`

#### Sui

- `createSuiClient(url)` / `getFullnodeUrl(network)`
- `formatSuiBalance(mist)` / `parseSuiAmount(sui)`

## Usage

### Wallet Operations

```typescript
import { createWallet, detectChainAndAddress } from "@aryxn/wallet-core"

// Create a new wallet
const { address, key, mnemonic } = await createWallet("ethereum")

// Detect chain from input
const info = await detectChainAndAddress("0x123...")
console.log(info.chain) // "ethereum"
```

### Balance Check Example

```typescript
import {
  createEvmProvider,
  getEvmBalance,
  formatEther,
} from "@aryxn/wallet-core"

const provider = createEvmProvider("https://mainnet.infura.io/v3/...")
const balance = await getEvmBalance(provider, "0x...")
console.log(formatEther(balance))
```
