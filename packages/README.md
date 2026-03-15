# Aryxn Packages

[English] | [中文](./README.zh.md)

---

This directory contains shared domain modules and SDK layers used by Aryxn apps.

## Directory Map

- [arweave](./arweave): Arweave integration and upload/query helpers.
- [chain-constants](./chain-constants): Shared chain IDs, token metadata, and configuration constants.
- [changelogs](./changelogs): Package-level changelog assets.
- [cross-chain](./cross-chain): Cross-chain bridge orchestration.
- [crypto](./crypto): Cryptographic primitives and encoding utilities.
- [exchange-chain](./exchange-chain): Exchange route planning engine.
- [query-chain](./query-chain): Multi-chain data querying abstraction.
- [storage](./storage): Local/persistent storage helpers.
- [swap-ethereum](./swap-ethereum): Ethereum-side swap execution adapters.
- [swap-multichain](./swap-multichain): Multi-chain swap coordination layer.
- [swap-solana](./swap-solana): Solana-side swap execution adapters.
- [wallet-core](./wallet-core): Core wallet lifecycle, account operations, and signing abstractions.

## Design Intent

- Keep chain-agnostic logic composable and package-first.
- Keep app integration thin by exposing stable interfaces from packages.
- Keep constants and protocol metadata centralized to avoid drift.

## Notes

- Most package folders include dedicated READMEs for detailed APIs and usage.
- Use this file as the package index and ownership map.
