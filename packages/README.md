# Aryxn Packages

[English] | [中文](./README.zh.md)

---

This directory contains the shared domain modules used by the Aryxn app.

## Directory Map

- [arweave](./arweave) (`@alixex/arweave`): Arweave uploads, fee estimation, (de)compression, and GraphQL search + cache.
- [crypto](./crypto) (`@alixex/crypto`): symmetric encryption (libsodium XChaCha20-Poly1305), encoding helpers, and PBKDF2 key derivation.
- [storage](./storage) (`@alixex/storage`): encrypted `localStorage` cache and IndexedDB key-value helpers.
- [changelogs](./changelogs): package-level changelog assets.

## Design Intent

- Keep chain-agnostic logic composable and package-first.
- Keep app integration thin by exposing stable interfaces from packages.
- The chain (Arweave / Irys) is the source of truth; `storage` is only a local cache.

## Notes

- `arweave`, `crypto`, and `storage` include dedicated READMEs with detailed APIs and usage.
- Use this file as the package index and ownership map.
