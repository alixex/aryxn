# Aryxn Apps

[English] | [中文](./README.zh.md)

---

This directory contains user-facing applications in the Aryxn monorepo.

## Directory Map

- [vault](./vault): Main web app for account management, uploads, dashboard, swap, and bridge workflows.

## App Responsibilities

### vault

- End-user interface built with React + Vite
- Multi-chain account and wallet operations
- Upload and encrypted permanent storage flows
- Transaction history and dashboard UX
- Settings, localization, and runtime configuration

## Related Docs

- [Vault README (EN)](./vault/README.md)
- [Vault README (ZH)](./vault/README.zh.md)

## Conventions

- Keep app-specific docs inside each app folder.
- Keep reusable business logic in `packages/`, not in app-only layers.
- Treat `apps/README.md` as the directory entry point and ownership map.
