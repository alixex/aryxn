# Aryxn

<p align="center">
  <img src="https://alixex.github.io/aryxn/icon.jpg" alt="Aryxn Icon" width="200" />
</p>

[English] | [中文](./README.zh.md)

---

## **Product Overview**

**Aryxn** is a user-sovereignty-first Web3 application that combines **multi-chain asset management**, **decentralized exchange**, **cross-chain bridging**, and **permanent file storage** into one unified platform.  
Inspired by Plato's concept of "aryxn" (recollection), it empowers you to control your digital assets and preserve what matters—securely, privately, and forever.

**🌐 Live**: https://alixex.github.io/aryxn/

---

## **Core Features**

### 🔐 **Multi-Chain Account Management**

- **Unified account hub**: Manage accounts across **Ethereum**, **Solana**, **Sui**, **Arweave**, **Bitcoin**, and other major blockchains in one secure place
- **Dual wallet support**: Use internal accounts (encrypted locally with your master password) or connect external wallets like MetaMask and Phantom
- **Real-time balances**: View token balances and account details across all chains with automatic synchronization
- **Secure by design**: Private keys and sensitive data are encrypted locally with your master password—never leaving your browser
- **Easy import**: Import existing accounts via private keys or seed phrases, or create new ones with just a few clicks

### 💱 **Decentralized Exchange (DEX)**

- **Smart token swaps**: Exchange tokens on the same chain with automatic routing to find the best rates
- **Multi-hop optimization**: Execute complex swap routes through multiple liquidity pools for optimal pricing
- **Price impact protection**: Real-time price impact calculation and slippage control to protect against unfavorable trades
- **Low fees**: Minimize transaction costs through intelligent route optimization
- **Seamless UX**: Unified swap interface with instant quotes and one-click execution

### 🌉 **Cross-Chain Bridge**

- **Universal bridging**: Transfer assets between different blockchains seamlessly (e.g., ETH → SOL, BTC → AR)
- **USDC/USDT routing**: Smart routing through stablecoin intermediaries for reliable cross-chain transfers
- **Transaction tracking**: Monitor long-running bridge operations with real-time status updates and detailed progress tracking
- **Batch processing**: Execute multiple bridge transactions efficiently with batch support
- **Safety checks**: Automatic validation of destination addresses to prevent cross-chain transfer errors
- **Estimated timing**: Clear ETA display for bridge operations so you know exactly when to expect your assets

### 📁 **Permanent File Storage**

- **Forever storage**: Upload files to Arweave blockchain for permanent, immutable storage that lasts as long as the network exists
- **Flexible privacy**: Choose between **public storage** for open access or **private encrypted storage** for sensitive files
- **End-to-end encryption**: Files are encrypted locally before upload using your master password—only you hold the decryption key
- **Smart organization**: Organize files with folders, tags, and custom descriptions for easy management
- **Powerful search**: Quickly find files with full-text search and advanced filtering by name, type, date, or tags
- **Universal access**: Access your files from any device using decentralized file links—your data follows you everywhere
- **Upload cost optimization**: Real-time fee estimation and intelligent payment routing across chains to minimize upload costs

### 📊 **Unified Dashboard**

- **Complete overview**: View all your activities—uploads, swaps, bridges, and transfers—in one comprehensive interface
- **Transaction history**: Track every operation with detailed metadata including timestamps, amounts, fees, and status
- **Storage analytics**: Monitor your total uploaded files, storage usage, and upload history
- **Cross-chain sync**: Automatic synchronization of on-chain data to local SQLite cache for fast access and offline viewing
- **Advanced filtering**: Search and filter across all transaction types with powerful query capabilities

---

## **Privacy & Security**

### 🔒 **Your Data, Your Control**

- **Local-first architecture**: All sensitive information (private keys, master password, encrypted data) is stored and encrypted locally in your browser—never sent to any server
- **Zero-knowledge design**: Aryxn never collects, stores, or has access to your data. We can't see what you store, even if we wanted to
- **Privacy by default**: Designed to minimize centralized dependencies and reduce trust assumptions—you remain in full control
- **Browser-native**: The entire application operates entirely in your browser, with no backend servers handling your sensitive data

### 🛡️ **Encryption & Protection**

- **End-to-end encryption**: Files are encrypted locally using industry-standard encryption before upload—only you can decrypt them
- **Master password protection**: A single master password protects all your accounts and encrypted files, giving you one key to all your data
- **Re-authentication**: Extra password confirmation required for sensitive actions like viewing private keys or exporting accounts
- **Secure by default**: All sensitive operations require explicit user confirmation—no accidental exposure of your data

---

## **Use Cases**

### � **Multi-Chain Portfolio Management**

Manage all your crypto assets across different blockchains from a single interface. Swap tokens, bridge assets between chains, and track your portfolio—all without juggling multiple wallets and interfaces.

### 🔄 **Cross-Chain Trading**

Execute complex cross-chain trades with ease. Bridge assets from one chain to another, swap to your desired token, and manage your positions across the entire Web3 ecosystem seamlessly.

### 📦 **Personal Digital Vault**

Build your personal digital archive by securely storing receipts, certificates, photos, and important documents on blockchain. Use encryption for sensitive files, ensuring your private information stays private forever.

### 🎨 **Creator Proofs & IP Protection**

Publish and timestamp your creative work on blockchain for permanent, verifiable proof of creation. Perfect for artists, writers, musicians, and creators who need immutable proof of ownership and creation date.

### 💼 **DeFi Power User**

Access liquidity across multiple chains, execute optimal swap routes, and bridge assets where yields are highest. All with intelligent routing, price protection, and real-time cost estimation.

### 🗄️ **Long-term Data Backup**

Create permanent backups of critical files that will outlast any single company or service. Once uploaded to Arweave, your files are stored forever, protected by decentralized infrastructure and cryptographic guarantees.

---

## **Getting Started**

1. **Visit** https://alixex.github.io/aryxn/
2. **Create** a master password to encrypt your data (make sure to remember it—it's the only way to access your encrypted data)
3. **Set up accounts**:
   - Import existing accounts via private keys or seed phrases
   - Create new accounts for supported blockchains
   - Or connect external wallets like MetaMask or Phantom
4. **Start trading**:
   - **Swap** tokens on the same chain with optimal routing
   - **Bridge** assets between different blockchains seamlessly
   - **Transfer** tokens to other addresses safely
5. **Upload files**:
   - Choose between public or encrypted storage
   - Files are automatically routed to your Arweave account
   - System will suggest cross-chain routes if you need to fund your Arweave account
6. **Track everything**: Monitor all your swaps, bridges, transfers, and uploads from the unified dashboard

---

## **Technical Stack**

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **State Management**: Zustand with local persistence
- **Multi-Chain SDK**: Custom wallet-core integrating Ethereum, Solana, Sui, Bitcoin, Arweave
- **DEX Integration**: Multi-hop swap routing with intelligent pathfinding
- **Bridge Provider**: Li.Fi API for optimal cross-chain routing
- **Storage**: Arweave for permanent file storage + Local SQLite for fast indexing
- **Encryption**: AES-256-GCM for local encryption, end-to-end encrypted file uploads

## **Monorepo Architecture**

```
aryxn/
├── apps/
│   └── web/              # Main Web application
├── packages/
│   ├── wallet-core/      # Multi-chain wallet management
│   ├── arweave/          # Arweave storage integration
│   ├── swap-ethereum/    # Ethereum DEX integration
│   ├── swap-solana/      # Solana DEX integration
│   ├── swap-multichain/  # Multi-hop swap orchestration
│   ├── cross-chain/      # Cross-chain bridge logic
│   ├── exchange-chain/   # Exchange routing engine
│   ├── query-chain/      # Multi-chain data querying
│   ├── chain-constants/  # Chain configuration & constants
│   ├── crypto/           # Cryptographic utilities
│   └── storage/          # Local storage & SQLite
```

## **Open Source**

Aryxn is open source and licensed under **AGPL-3.0**.  
See [LICENSE](./LICENSE) for details.

**Contributions Welcome!**  
Check out our [GitHub repository](https://github.com/ranuts/aryxn) to contribute.

---

**Aryxn — Built for long-term memory.**
