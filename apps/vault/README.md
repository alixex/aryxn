# Aryxn Vault

<p align="center">
	<img src="https://alixex.github.io/aryxn/icon.jpg" alt="Aryxn Icon" width="200" />
</p>

[English] | [中文](./README.zh.md)

---

## Product Overview

**Aryxn Vault** is a user-sovereignty-first Web3 app that combines:

- Multi-chain account management
- Decentralized token swaps (DEX)
- Cross-chain bridge routing
- Permanent file storage on Arweave

It is designed for people who want one interface for assets, transactions, and long-term data preservation, while keeping sensitive keys and encrypted content local.

Live app: https://alixex.github.io/aryxn/

---

## Core Features

### Multi-Chain Account Management

- Manage accounts for Ethereum, Solana, Sui, Arweave, Bitcoin, and more
- Use internal vault accounts or external wallets (MetaMask, Phantom, etc.)
- Track balances and account state in one place
- Keep sensitive data locally encrypted under your master password

### DEX Swap

- Smart routing for same-chain token swaps
- Multi-hop optimization across liquidity paths
- Real-time price impact and slippage awareness
- Fast quote-to-execution workflow

### Cross-Chain Bridge

- Move assets across chains (e.g. ETH -> SOL, BTC -> AR)
- Stablecoin-assisted routes for robust bridging
- Status tracking for long-running bridge transactions
- Batch-friendly transaction handling

### Permanent File Storage

- Upload files to Arweave for permanent, immutable storage
- Choose public or encrypted-private upload mode
- End-to-end encryption before upload (local-only key material)
- Organize with metadata and search by multiple dimensions
- Cost-aware upload flow with fee estimation and payment routing

### Unified Dashboard

- View uploads, swaps, bridges, and transfers in one place
- Inspect operation history and status details
- Monitor storage usage and upload activity
- Sync on-chain data into local SQLite cache for responsive UX

---

## Privacy & Security

- Local-first architecture for keys and sensitive state
- Zero-knowledge design for encrypted content
- Master-password protected vault with explicit confirmation for critical actions
- Browser-native runtime with no backend trust required for private material

---

## Typical Use Cases

- Multi-chain portfolio operations from one interface
- Cross-chain execution with route and status visibility
- Personal encrypted archive with permanent availability
- Creator proof-of-origin and timestamped publication
- Long-term backup of critical digital files

---

## Quick Start

1. Open https://alixex.github.io/aryxn/
2. Create your master password (store it safely)
3. Add or connect accounts
4. Swap / bridge / transfer as needed
5. Upload files in public or encrypted mode
6. Track everything from the dashboard

---

## Monorepo Context

This app lives at [apps/vault](./).

Key related packages include:

- `@aryxn/wallet-core`
- `@aryxn/arweave`
- `@aryxn/storage`
- `@aryxn/swap-multichain`
- `@aryxn/cross-chain`
- `@aryxn/chain-constants`

---

## License

Aryxn is open source under **AGPL-3.0-or-later**.

See [LICENSE](../../LICENSE).

---

Aryxn Vault - Built for long-term memory.
