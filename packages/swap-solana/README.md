# @aryxn/sdk-solana

Solana Swapper SDK with native Jupiter Aggregator v6 integration for the Aryxn Universal Router.

## Installation

```bash
pnpm add @aryxn/sdk-solana
```

## Usage

### 1. Initialize

```typescript
import { SolanaSwapper } from "@aryxn/sdk-solana"

const swapper = new SolanaSwapper({
  rpcUrl: "https://api.mainnet-beta.solana.com",
  programId: "3cUyodUx...",
})

// Set wallet and IDL
swapper.setWallet(anchorWallet, idl)
```

### 2. Get Jupiter Quote

```typescript
const quote = await swapper.getQuote({
  inputMint: "...",
  outputMint: "...",
  amount: 1000000,
})
```

### 3. Execute CPI Swap

This method automatically fetches CPI instructions from Jupiter and routes them through the Aryxn Universal Router for fee collection and monitoring.

```typescript
const signature = await swapper.swap({
  user: wallet.publicKey,
  quoteResponse: quote,
})
```

## Features

- **Automated PDA Derivation**: Handles `router_state` and `token_config` accounts automatically.
- **Jupiter v6 API Support**: Fetches optimal routes and dynamic instruction data.
- **Multisig Friendly**: Designed to work with various wallet implementations.

## License

MIT
