# Aryxn Apps

[English] | [中文](./README.zh.md)

---

This directory contains the user-facing application(s) in the Aryxn monorepo.

## Directory Map

- [link](./link): The Aryxn web app — upload a file, get a permanent link on Arweave or Irys.

## App Responsibilities

### link (`@alixex/link`)

- Framework-free SPA built with **ranui** (Geist design system), TypeScript, and Vite
- Upload flow to **Arweave** and **Irys**, with optional client-side encryption
- Account management: local encrypted Arweave keyfile, external **Wander** wallet, and **EVM** wallets (EIP-6963) to fund Irys
- Local history & search of your own links; bilingual (en / zh) and system / light / dark themes

## Conventions

- Keep app-specific docs inside each app folder.
- Keep reusable domain logic in `packages/`, not in app-only layers.
- Treat `apps/README.md` as the directory entry point and ownership map.
