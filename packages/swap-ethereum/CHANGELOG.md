# Changelog - @aryxn/swap-ethereum

## [1.1.0] - 2026-02-21

### Added

- **Native ETH Support**: Swap directly using native ETH (`EthereumSwapper.NATIVE_ETH`). The SDK handles approval skipping automatically.
- **Multi-Chain Presets**: Added `CHAIN_CONFIGS` with token addresses for `BASE`, `ARBITRUM`, and `MAINNET`.
- **Admin Methods**: Added `setFeeRate()`, `withdrawFees()`, `setFeeRecipient()`, and `setPaused()` wrapper methods (owner-only operations).
- **`setFeeRate` ABI**: Synced with contract security audit (L-3) — owner can now update fee rate up to 100 bps (1%) via SDK.
- **`accumulatedFees` ABI**: Query per-token accumulated fee balance on-chain.
- **Typed `getStats()`**: Return type is now fully typed as `{ totalVolume, totalFees, lastUpdate, paused }`.

### Changed

- **`deadline` type**: Changed from `number` to `bigint` in `SwapParams` and `swap()` args to avoid JavaScript precision loss for large timestamps.
- **On-Chain Pathfinding**: Removed the legacy `route` parameter from the `swap` method. The contract's on-chain `PathFinder` handles optimal routing automatically.
- **MEV Protection Default**: Default protection level is `MEDIUM` (Chainlink oracle validation).
- **Exact Approval**: Added `exactApproval` option — set to `true` to approve only the required amount instead of `MaxUint256`.

### Fixed

- **`package.json`**: Removed misleading `"files": ["dist"]` field — this package is consumed via source reference, no build step required.

## [1.0.0] - 2026-02-20

### Added

- Initial release with `EthereumSwapper` class.
- Basic swap support for ERC-20 tokens.
- Integration with Aryxn Universal Router contract ABI.
