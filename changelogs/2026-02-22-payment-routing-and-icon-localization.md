# Changelog: L2 Payment Routing Optimization & Professional Icon Localization

**Date**: 2026-02-22  
**Status**: Completed  
**Impact**: Improved L2 payment efficiency, enhanced UI transparency, and standardized brand aesthetics.

## 1. L2 Payment Routing Optimization

We optimized the payment routing for Arweave storage on L2 EVM networks (Base, Arbitrum, Optimism).

-   **Native L2 Support**: Replaced the previous "bridge to L1" flow for stablecoins (USDC/USDT) on L2 networks.
-   **Local Swap Engine**: Implemented an automated local swap to native ETH within the same L2 network using the Exchange SDK.
-   **Benefits**:
    -   Reduced confirmation time from minutes/hours to seconds.
    -   Significant reduction in gas fees (no L1 bridge transactions required).
    -   Smoother user experience for L2-native users.

## 2. UI Transparency & Routing Hints

Improved how users understand the underlying transaction flow before they commit funds.

-   **Execution Path Hints**: Added diagnostic hints in `UploadExecutionCard` to explicitly show if a transaction is `DIRECT`, `SWAP`, or `BRIDGE`.
-   **Bridge Confirmation Enhancement**: Redesigned the bridge confirmation dialog with clear `[Source] -> [Target]` visualizations and professional branding.
-   **Smart Conflict Detection**: Enhanced `SwapTokenAmountInput` to identify when a user is switching to a token/chain that requires an intermediate bridge, providing immediate feedback.

## 3. Professional Icon System (Localized)

Replaced inconsistent emojis with a centralized, high-quality asset management system.

-   **Localized Assets**: Hosted official SVG and PNG logos for all supported chains (Ethereum, Bitcoin, Solana, Base, Arbitrum, Optimism, Arweave) within the `@aryxn/chain-constants` package.
-   **Centralized Metadata**: Created a single source of truth for chain branding, ensuring consistent visuals across the entire monorepo.
-   **Refined Aesthetics**:
    -   Fixed Solana icon to use official white-on-dark circle branding.
    -   Recovered high-quality Arweave and Irys logos from official sources.
-   **Performance**: Icons are served locally from the web app's public directory, eliminating external host dependencies.

## 4. Technical Changes

-   Modified `apps/web/src/lib/contracts/upload-payment-config.ts` to prioritize L2 native tokens.
-   Created `packages/chain-constants/src/icons.ts` and `apps/web/src/components/common/ChainIcon.tsx`.
-   Refactored `UniversalSwapCard`, `SwapTokenAmountInput`, `TransferCard`, and `BridgeConfirmationDialog`.
