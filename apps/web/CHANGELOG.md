# Changelog - apps/web

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
