# Changelog - 2026-02-18

## Payment Architecture Overhaul (3 Tiers)

We have implemented a comprehensive 3-tier payment and storage architecture to optimize for speed, cost, and universal accessibility.

### 1. Tier 1: Native Arweave (AR)
- **Status**: Operational
- **Flow**: Direct upload to Arweave using native AR tokens.
- **Improvements**: Bypasses Irys funding to save on bridge/swap overhead when the user already holds AR.

### 2. Tier 2: Irys Rapid Integration (ETH, SOL, USDC)
- **Status**: Operational
- **Flow**: Instant funding via Irys nodes on Ethereum and Solana.
- **Improvements**: Real-time upload confirmation (seconds instead of minutes). Added specific support for `USDC-ETH` and `USDC-SOL`.

### 3. Tier 3: Custom Bridge & Swap Fallback (BTC, USDT, Memes)
- **Status**: Initial Integration (New Package)
- **Package**: `@aryxn/sdk-bridge` (Created)
- **Flow**: Tokens like BTC or USDT are identified as "Bridge Required". The UI now gracefully handles these cases by notifying the user that a bridge/swap step is necessary before the final upload.
- **Architecture**: Separated from standard swaps to handle the asynchronous and multi-chain complexity of bridging.

### Technical Debt & Fixes
- Added missing `config` exports in `apps/web/src/lib/config.ts`.
- Finalized project rebranding from "Anamnesis" to **"Aryxn"** across storage tags.
- Unified upload hooks to coordinate complex payment states.
