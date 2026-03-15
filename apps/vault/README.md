# Aryxn Vault

<p align="center">
  <img src="https://alixex.github.io/aryxn/icon.jpg" alt="Aryxn Icon" width="200" />
</p>

[English] | [中文](./README.zh.md)

---

## Product Overview

**Aryxn Vault** is a user-sovereignty-first Web3 app that combines:

- Multi-chain account management
- Permanent file storage on Arweave
- Search and history tooling

It is designed for people who want one interface for assets, transactions, and long-term data preservation, while keeping sensitive keys and encrypted content local.

Live app: https://alixex.github.io/aryxn/

---

## Core Features

### Multi-Chain Account Management

- Manage accounts for Ethereum, Solana, Sui, Arweave, Bitcoin, and more
- Use internal vault accounts or external wallets (MetaMask, Phantom, etc.)
- Track balances and account state in one place
- Keep sensitive data locally encrypted under your master password

### Permanent File Storage

- Upload files to Arweave for permanent, immutable storage
- Choose public or encrypted-private upload mode
- End-to-end encryption before upload (local-only key material)
- Organize with metadata and search by multiple dimensions
- Cost-aware upload flow with fee estimation and route guidance

### Unified Dashboard

- View upload activity and file records in one place
- Inspect operation history and status details
- Monitor storage usage and upload activity
- Sync on-chain data into local SQLite cache for responsive UX

### Search & Retrieval

- Search by file name, metadata, and transaction ID
- Desktop and mobile optimized search flows
- Open/download resources with gateway fallback

---

## Privacy & Security

- Local-first architecture for keys and sensitive state
- Zero-knowledge design for encrypted content
- Master-password protected vault with explicit confirmation for critical actions
- Browser-native runtime with no backend trust required for private material

---

## Typical Use Cases

- Multi-chain account operations from one interface
- Personal encrypted archive with permanent availability
- Creator proof-of-origin and timestamped publication
- Data-first Web3 workflow with upload + retrieval
- Long-term backup of critical digital files

---

## Quick Start

1. Open https://alixex.github.io/aryxn/
2. Create your master password (store it safely)
3. Add or connect accounts
4. Manage accounts and set the active identity
5. Upload files in public or encrypted mode
6. Search, retrieve, and track records from the dashboard

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
