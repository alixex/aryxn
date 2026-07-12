# AGENTS.md

Project instructions for coding agents (Codex, etc.). See `README.md` for the
full overview.

## What this is

**ark** — a minimal, open-source web app for **permanent file links**: upload a
file, get a link that lasts as long as the network does, stored on **Arweave**
or **Irys**, optionally **encrypted client-side**.

- Live: https://ark.chaxus.com/
- The **product brand is "ark"**; the **repo / source / package scope stays
  `aryxn` / `@alixex`** — don't rename internal identifiers.

## Structure

```
apps/link/      # the app (@alixex/link) — upload, encryption, accounts, history
packages/
  arweave/      # @alixex/arweave — uploads, fees, (de)compression, GraphQL search
  crypto/       # @alixex/crypto — XChaCha20-Poly1305, encoding, PBKDF2
  storage/      # @alixex/storage — localStorage cache + IndexedDB
docs/           # design notes (e.g. multi-account-design.md)
```

## Commands

Requires **Node ≥ 20**, **pnpm ≥ 10**.

```bash
pnpm dev            # run apps/link at http://localhost:5173
pnpm build          # production build → apps/link/dist
pnpm lint           # oxlint across apps + packages
pnpm type-check     # tsc --noEmit across apps + packages
pnpm run ci         # lint + type-check + build  (NOT `pnpm ci` — reserved word)
pnpm run format:check
```

Deploy is **Cloudflare Pages via Git integration** (build `pnpm build`, output
`apps/link/dist`, custom domain `ark.chaxus.com`). CI is
`.github/workflows/ci.yml` (lint / type-check / build).

## Conventions & hard constraints

- **UI uses [ranui](https://www.npmjs.com/package/ranui)** (framework-free Web
  Components + a fine-grained reactive builder, Geist design system) — **not
  React**. Import per-component subpaths, e.g. `import "ranui/button"`; theme via
  `ranui/theme`. Style with `--ran-color-*` tokens (`bg`, `text`,
  `text-secondary`, `border`, `bg-subtle`, …), which flip with the theme.
- **Do NOT change these data contracts** (backward compatibility):
  - On-chain tag `App-Name: Aryxn` (breaking it makes old assets unlistable).
  - `localStorage["aryxn:account"]` (breaking it orphans existing accounts).
- **No hardcoded domains** — viewer links are built from `location.origin`.
- Keep it minimal: the app is upload → permanent link + accounts + encryption.
  No wallet transfer, no DEX, no multi-chain beyond Arweave / Irys.
- Prefer `ranui` / `ranuts` for UI and utilities before adding new deps.
