# Aryxn

<p align="center">
  <img src="https://alixex.github.io/aryxn/icon.jpg" alt="Aryxn Icon" width="200" />
</p>

[English] | [中文](./README.zh.md)

---

## Product Overview

**Aryxn** is a user-sovereignty-first Web3 application that combines **multi-chain account management**, **permanent file storage**, and **history/search tooling** into one unified platform.  
Inspired by Plato's concept of "aryxn" (recollection), it empowers you to control your digital assets and preserve what matters—securely, privately, and forever.

**🌐 Live**: https://alixex.github.io/aryxn/

---

## Core Features

### 🔐 Multi-Chain Account Management

- **Unified account hub**: Manage accounts across **Ethereum**, **Solana**, **Sui**, **Arweave**, **Bitcoin**, and other major blockchains in one secure place
- **Dual wallet support**: Use internal accounts (encrypted locally with your master password) or connect external wallets like MetaMask and Phantom
- **Real-time balances**: View token balances and account details across all chains with automatic synchronization
- **Secure by design**: Private keys and sensitive data are encrypted locally with your master password—never leaving your browser
- **Easy import**: Import existing accounts via private keys or seed phrases, or create new ones with just a few clicks

### 📁 Permanent File Storage

- **Forever storage**: Upload files to Arweave blockchain for permanent, immutable storage that lasts as long as the network exists
- **Flexible privacy**: Choose between **public storage** for open access or **private encrypted storage** for sensitive files
- **End-to-end encryption**: Files are encrypted locally before upload using your master password—only you hold the decryption key
- **Smart organization**: Organize files with folders, tags, and custom descriptions for easy management
- **Powerful search**: Quickly find files with full-text search and advanced filtering by name, type, date, or tags
- **Universal access**: Access your files from any device using decentralized file links—your data follows you everywhere
- **Upload cost optimization**: Real-time fee estimation and route guidance to reduce upload costs

### 📊 Unified Dashboard

- **Complete overview**: View your upload activity, file records, and status in one interface
- **File history**: Track file operations with timestamps, metadata, size, and storage network information
- **Storage analytics**: Monitor your total uploaded files, storage usage, and upload history
- **Cross-chain sync**: Automatic synchronization of on-chain data to local SQLite cache for fast access and offline viewing
- **Advanced filtering**: Search and filter across all transaction types with powerful query capabilities

### 🔎 Search & Retrieval

- **Unified search**: Search by file name, metadata, and transaction IDs
- **Global/mobile search UX**: Dedicated search experiences for desktop and mobile
- **Direct resource access**: Open/download resources via generated links and gateway fallbacks

---

## Privacy & Security

### 🔒 Your Data, Your Control

- **Local-first architecture**: All sensitive information (private keys, master password, encrypted data) is stored and encrypted locally in your browser—never sent to any server
- **Zero-knowledge design**: Aryxn never collects, stores, or has access to your data. We can't see what you store, even if we wanted to
- **Privacy by default**: Designed to minimize centralized dependencies and reduce trust assumptions—you remain in full control
- **Browser-native**: The entire application operates entirely in your browser, with no backend servers handling your sensitive data

### 🛡️ Encryption & Protection

- **End-to-end encryption**: Files are encrypted locally using industry-standard encryption before upload—only you can decrypt them
- **Master password protection**: A single master password protects all your accounts and encrypted files, giving you one key to all your data
- **Re-authentication**: Extra password confirmation required for sensitive actions like viewing private keys or exporting accounts
- **Secure by default**: All sensitive operations require explicit user confirmation—no accidental exposure of your data

---

## Use Cases

### 🔐 Multi-Chain Account Operations

Manage your blockchain accounts from one interface, switch active identities, and keep keys under local encryption protection.

### 📦 Personal Digital Vault

Build your personal digital archive by securely storing receipts, certificates, photos, and important documents on blockchain. Use encryption for sensitive files, ensuring your private information stays private forever.

### 🎨 Creator Proofs & IP Protection

Publish and timestamp your creative work on blockchain for permanent, verifiable proof of creation. Perfect for artists, writers, musicians, and creators who need immutable proof of ownership and creation date.

### 🧭 Data-First Web3 Workflow

Use one app to manage account identities, upload encrypted/public files, and retrieve historical records quickly with built-in search.

### 🗄️ Long-term Data Backup

Create permanent backups of critical files that will outlast any single company or service. Once uploaded to Arweave, your files are stored forever, protected by decentralized infrastructure and cryptographic guarantees.

---

## Getting Started

1. **Visit** https://alixex.github.io/aryxn/
2. **Create** a master password to encrypt your data (make sure to remember it—it's the only way to access your encrypted data)
3. **Set up accounts**:
   - Import existing accounts via private keys or seed phrases
   - Create new accounts for supported blockchains
   - Or connect external wallets like MetaMask or Phantom
4. **Start using core workflows**:
   - **Manage accounts** across supported chains
   - **Upload files** in public or encrypted mode
   - **Search and access** your file records from dashboard/search tools
5. **Upload files**:
   - Choose between public or encrypted storage
   - Files are automatically routed to your Arweave account
   - System will provide payment path guidance when needed
6. **Track everything**: Monitor uploads, history, and storage analytics from the unified dashboard

---

## Technical Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **State Management**: Zustand with local persistence
- **Multi-Chain SDK**: Custom wallet-core integrating Ethereum, Solana, Sui, Bitcoin, Arweave
- **Storage**: Arweave for permanent file storage + Local SQLite for fast indexing
- **Encryption**: AES-256-GCM for local encryption, end-to-end encrypted file uploads

## Monorepo Architecture

### apps/

- **vault/**: Primary end-user web application (account management, upload, dashboard, search, settings)

See also: [apps/README.md](apps/README.md)

### packages/

- **arweave/**: Arweave interaction utilities and integration logic
- **chain-constants/**: Shared chain IDs, token metadata, routing constants, and network configuration
- **changelogs/**: Package-level changelog assets used by release/documentation workflows
- **cross-chain/**: Cross-chain bridge orchestration and state handling
- **crypto/**: Shared cryptographic primitives and encoding helpers
- **exchange-chain/**: Swap/exchange route planning across supported chains
- **query-chain/**: On-chain/off-chain query abstraction for multi-chain data access
- **storage/**: Persistent/local storage helpers, including indexed data support
- **swap-ethereum/**: Ethereum-specific swap execution adapters
- **swap-multichain/**: Multi-chain swap coordination layer
- **swap-solana/**: Solana-specific swap execution adapters
- **wallet-core/**: Core wallet lifecycle, account operations, and signing abstractions

See also: [packages/README.md](packages/README.md)

### Repository Layout (High-Level)

```
aryxn/
├── apps/                 # User-facing applications
│   └── vault/
├── packages/             # Shared domain modules and SDK layers
│   ├── arweave/
│   ├── chain-constants/
│   ├── changelogs/
│   ├── cross-chain/
│   ├── crypto/
│   ├── exchange-chain/
│   ├── query-chain/
│   ├── storage/
│   ├── swap-ethereum/
│   ├── swap-multichain/
│   ├── swap-solana/
│   └── wallet-core/
├── docs/                 # Product, architecture, and planning docs
├── scripts/              # Automation and setup scripts
└── client/               # Client assets/build workspace
```

## Open Source

Aryxn is open source and licensed under **AGPL-3.0**.  
See [LICENSE](./LICENSE) for details.

**Contributions Welcome!**  
Check out our [GitHub repository](https://github.com/ranuts/aryxn) to contribute.

---

**Aryxn — Built for long-term memory.**
