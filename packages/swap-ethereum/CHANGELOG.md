# Changelog - @aryxn/swap-ethereum

## [1.1.0] - 2026-02-21

### Added
- **Native ETH Support**: You can now perform swaps directly using native ETH. The SDK handles auto-wrapping/unwrapping logic internally.
- **Multi-Chain Presets**: Added `ChainPresets` for `BASE`, `ARBITRUM`, and `MAINNET` to simplify initialization.
- **Improved Security**: Default MEV protection level set to `MEDIUM`.
- **Exact Approval Opt-out**: Added `exactApproval` option for users who want to approve specific amounts rather than infinite.

### Changed
- **On-Chain Pathfinding**: Removed the legacy `route` parameter from the `swap` method. The SDK now leverages the on-chain `PathFinder` for deterministic routing.
- **Enhanced Configuration**: The constructor now accepts a `chainId` to automatically resolve the correct contract and token addresses.

### Fixed
- **Decimal Normalization**: Fixed inconsistent decimal handling between different chain adapters.
- **Address Formatting**: Ensured all addresses are correctly checksum-verified.
