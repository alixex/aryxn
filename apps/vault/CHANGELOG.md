# Changelog - apps/vault

## [1.2.0] - 2026-03-08

### Added

- **Irys L1 Support**: Added comprehensive native support for Irys as an independent L1 blockchain.
- **Storage Tiering**: Users can now select between "Permanent Storage" and "Term Storage (Cheaper)" during upload to optimize L1 costs.
- **Federated Search Filter**: The Global Search component now supports filtering between "All Networks", "Irys L1", and "Arweave" natively.
- **Native $IRYS Payments**: Added native $IRYS token to the payment options, allowing users to select it alongside other multi-chain assets.

### Changed

- **Gateway Routing**: Re-routed file downloads and manifest syncing to natively separate Irys (`https://gateway.irys.xyz/`) from Arweave (`https://arweave.net/`).
- **Database Schema**: Replaced hardcoded "arweave" storage type with dynamic tracking of "arweave" or "irys" in local `file_indexes`.
- **Query Adapter**: Updated the `query-chain` adapter to concurrently run GraphQL searches across Irys and Arweave and respect network-specific isolation filters.

## [1.1.0] - 2026-02-21

### Added

- **Multi-Chain Swap Interface**: The swap card now supports dynamic network switching across Ethereum, Base, and Arbitrum.
- **Network Awareness**: Integrated `wagmi`'s `useChainId` to automatically sync the swap configuration with the connected wallet's network.
- **Base & Arbitrum Support**: Added contract addresses and token mappings for Base (including cbBTC) and Arbitrum.
- **New Swapper Interface**: Updated ABI to support the latest `SwapParams` structure, including integrated MEV protection levels and custom deadlines.

### Changed

- **Config Architecture**: Refactored `addresses.ts` and `token-config.ts` from static single-chain definitions to dynamic `ChainId`-based mappings.
- **Hook Refactor**: `use-swap` and `use-swap-quote` now dynamically resolve target contracts and tokens based on the active network.

### Improved

- **Routing Resilience**: The interface now correctly handles network-specific routing (e.g., Aerodrome on Base, Uniswap V3 on Arbitrum).
- **Security Feedback**: Better integration of protection levels in the swap execution flow.
