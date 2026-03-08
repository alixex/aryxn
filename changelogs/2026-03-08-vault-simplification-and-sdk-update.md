# Changelog: Vault App Simplification & SDK Upgrade

**Date:** 2026-03-08

## Summary

This update significantly simplifies the Vault application, focusing on core Arweave storage functionality and expanding multi-token payment support via Irys SDK. We have removed external wallet dependencies and legacy swap/cross-chain UI to provide a more streamlined user experience.

## Major Changes

### 1. Core Simplification

- **Removed External Wallet Support**: The application no longer requires connecting external Arweave or EVM wallets. All keys are managed securely within the internal Vault.
- **Removed Swap & Bridge UI**: Legacy swap and cross-chain bridge interfaces have been removed in favor of direct multi-token payments for storage fees.
- **Account Dashboard Expanded Support**: The `/account` page now natively renders `Polygon`, `BSC`, and `Avalanche` networks, allowing users to track balances and export keys for newly generated EVM vaults seamlessly.
- **Unified Account Selection**: Simplified the navigation and account management interfaces to focus solely on internal accounts.

### UI Simplification & Upload Page Redesign

- Completely redesigned the `/upload` page layout into a seamless single-page fluid interface.
- Removed legacy multi-step components designed for external bridge/swap scenarios:
  - `AccountSelector.tsx`
  - `FileSelectionCard.tsx`
  - `UploadConfigurationCard.tsx`
  - `UploadExecutionCard.tsx`
  - `Steps` UI Component
  - `ArweaveFeeInfo.tsx`
  - `SecurityNotice.tsx`
- Built a massive native Drag-and-Drop zone with dynamically sliding-in inline Payment/Encryption settings when files are selected.
- Enhanced UX by auto-selecting active Arweave internal wallets or interactively prompting automatic creation.

### 2. SDK & Storage Enhancement

- **Expanded Irys SDK Support**: Added support for more payment tokens and networks, including:
  - **Polygon**: Pay with MATIC, USDC, USDT.
  - **BSC**: Pay with BNB, USDC, USDT.
  - **Avalanche**: Pay with AVAX, USDC, USDT.
  - **L2s**: Expanded support for Arbitrum, Optimism, Base, Linea, and Scroll.
- **Centralized Arweave Storage**: Optimized the upload process using Arweave.js and Irys SDK to ensure reliable data permanence.
- **Improved Fee Estimation**: Updated internal configuration to correctly map native and L2 tokens for storage fee calculations.

### 3. Technical Debt Removal

- Removed `RainbowKit` and `Wagmi` dependencies from the core application.
- Cleaned up orphaned components and hooks related to the legacy swap system.
- Standardized chain constants across the monorepo.

## Impacts

- **User Experience**: Users can now pay for Arweave storage using a much wider variety of tokens directly from their internal accounts.
- **Performance**: Reduced bundle size by removing heavy external wallet libraries.
- **Reliability**: Simplified the codebase, reducing potential points of failure in the upload and payment flows.
