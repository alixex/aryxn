# Aryxn

<p align="center">
   <img src="https://ark.chaxus.com/icon.jpg" alt="Aryxn Icon" width="200" />
</p>

[English] | [中文](./README.zh.md)

---

## Overview

**Aryxn** is a minimal, open-source web app for **permanent file links**. Upload a file, get a
link that lasts as long as the network does — stored on **Arweave** or **Irys**, optionally
**encrypted client-side** so only holders of the link can open it.

Everything runs in your browser. Keys and passwords never leave the device, and the chain stays
the single source of truth — the app only keeps a small local cache for speed.

**🌐 Live**: https://ark.chaxus.com/

---

## Features

### 🔗 Permanent links

- Upload to **Arweave** (pay with an Arweave account) or **Irys** (pay with an EVM wallet), from one UI
- Every upload writes the same `App-Name: Aryxn` tag contract, so links stay queryable across versions
- Real-time upload progress and a shareable permanent URL at the end

### 🔒 Client-side encryption

- Optional per-file encryption using **XChaCha20-Poly1305** (libsodium `crypto_secretbox`)
- The decryption key lives in the **URL fragment** (`#…`) — never sent to any server, so only
  someone with the full link can decrypt
- A built-in viewer route (`#/view/<chain>/<txId>/<key>`) fetches the ciphertext and decrypts in-browser

### 🔑 Accounts

- **Local account**: an Arweave keyfile generated or imported in-browser, stored **encrypted**
  (password-derived key via PBKDF2) in `localStorage` — no extension required
- **External wallet**: connect **Wander** (formerly ArConnect) to sign Arweave uploads
- **EVM wallet**: discovered via **EIP-6963** (MetaMask, etc.) to fund Irys uploads
- Export your keyfile as plain or encrypted JSON for backup / migration

### 🗂️ History & search

- Your links are cached locally (IndexedDB) and reconciled from both networks' gateways
- Instant client-side search over your own files
- Bilingual UI (English / 中文) and system / light / dark themes

---

## How it works

1. **Drop a file** → pick the network (Arweave or Irys) and, optionally, toggle encryption.
2. **Pay & upload** → the file (encrypted or not) is posted to the chain; progress is shown live.
3. **Get a permanent link** → copy it, share it. Encrypted links carry the key in the fragment.
4. **Find it later** → the dashboard lists and searches everything you've uploaded.

---

## Getting Started

Requires **Node ≥ 20** and **pnpm ≥ 10**.

```bash
pnpm install          # install workspace deps
pnpm dev              # run the app (apps/link) at http://localhost:5173
pnpm build            # production build → apps/link/dist
pnpm preview          # preview the production build
```

Quality gates:

```bash
pnpm lint             # oxlint across apps + packages
pnpm type-check       # tsc --noEmit across apps + packages
pnpm run ci           # lint + type-check + build
```

Deploy (Cloudflare Pages):

```bash
pnpm deploy:cloudflare
```

---

## Tech Stack

- **UI**: framework-free SPA built with [**ranui**](https://www.npmjs.com/package/ranui) — a
  Web-Components + fine-grained reactive builder implementing the **Geist** (Vercel) design system
- **Language / tooling**: TypeScript, Vite, pnpm workspaces
- **Storage**: Arweave (permanent) + Irys (permanent, EVM-funded); IndexedDB + localStorage for local cache
- **Payments**: `ethers` v6 and `@irys/web-upload` for Irys
- **Crypto**: libsodium XChaCha20-Poly1305 for file encryption; PBKDF2 (WebCrypto) for password-derived storage keys

---

## Monorepo Architecture

### apps/

- **link/** (`@alixex/link`): the web app — upload flow, encryption, accounts, history & search

See also: [apps/README.md](apps/README.md)

### packages/

- **arweave/** (`@alixex/arweave`): Arweave uploads, fee estimation, (de)compression, and GraphQL search + cache
- **crypto/** (`@alixex/crypto`): symmetric encryption (libsodium) and encoding/PBKDF2 helpers
- **storage/** (`@alixex/storage`): encrypted `localStorage` cache + IndexedDB key-value helpers

See also: [packages/README.md](packages/README.md)

### Repository Layout (High-Level)

```
aryxn/
├── apps/
│   └── link/             # The permanent-links web app (@alixex/link)
├── packages/
│   ├── arweave/          # Arweave upload / fee / compression / search
│   ├── crypto/           # Encryption + encoding helpers
│   └── storage/          # Local cache (localStorage + IndexedDB)
└── docs/                 # Design notes
```

## Open Source

Aryxn is open source and licensed under **AGPL-3.0**.
See [LICENSE](./LICENSE) for details.

**Contributions welcome** — see the [GitHub repository](https://github.com/ranuts/aryxn).

---

**Aryxn — a link that outlives everything.**
