# Multi-Account Management — Design

- **Date**: 2026-07-12
- **Status**: Approved (design), pending implementation plan
- **Scope**: `apps/link` only. No changes to upload/encryption business logic.

---

## 1. Context & Problem

The app (`@alixex/link`) today supports uploading files to Arweave / Irys with optional
client-side encryption, using either a local Arweave keyfile or an external wallet
(Wander for Arweave, an EIP-6963 EVM wallet to fund Irys).

The account layer is **single-slot**:

- `account.ts` stores exactly one encrypted keyfile under `localStorage["aryxn:account"]`;
  `localJwk` in memory holds one active account. Local and external accounts are mutually
  exclusive. To use another account the user must disconnect and re-unlock/import.
- The "my links" cache (`cache.ts`) is keyed only by `txId`, so it **mixes every account's
  resources**, while network reconcile is per active address. This is the root cause of the
  reported "different accounts show different resources" confusion.
- Only the active account's AR balance is shown (in the connect button). There is no
  per-account balance list, no EVM balance, and no upload-usage view.

**Goal**: evolve from "one active account" to a **multi-account book** with switching,
per-account resource isolation, and a per-account assets view (balance + upload usage).

### Non-goals (YAGNI)

- Upload **spend** statistics (per-tx fee lookup) — excluded.
- Non-native **token holdings** (ERC-20 etc.) — excluded.
- Wiring **compression** into the upload path — out of scope (tracked separately).
- Multiple simultaneous external wallets of the same kind — out of scope.

---

## 2. Account Model

A unified account record (no plaintext private key):

```ts
interface AccountRecord {
  id: string            // stable, generated
  type: "local" | "wander" | "evm"
  chain: "arweave" | "evm"
  address: string
  label: string         // user-editable, defaults to a shortened address
  createdAt: number
}
```

- `local` — an Arweave keyfile; ciphertext held in the vault (see §4).
- `wander` — external Arweave wallet (Wander/ArConnect); reference only, no key stored.
- `evm` — external EVM wallet address (funds Irys); reference only, no key stored.

---

## 3. Storage Layout (localStorage)

```
aryxn:accounts → AccountRecord[]                 // the book (no plaintext keys)
aryxn:active   → "<accountId>"                   // active-account pointer
aryxn:vault    → { [localAccountId]: <encryptedJWK string> }
```

The in-memory session holds `Map<accountId, ArweaveJWK>` for unlocked local accounts, plus
the master password (session only). Cleared on `lockVault()` / full disconnect.

---

## 4. Password Model — Scheme A (master vault)

All local accounts are encrypted under **one master password**, using the **existing**
crypto primitive (`encryptStringForStorage` / `decryptStringFromStorage` from
`@alixex/crypto`). Because the primitive is unchanged, existing ciphertext is portable.

- The master password **is** the password of the first/existing local account. Existing users
  inherit their old password `P`; brand-new users set it when creating their first local
  account (same as today's "create with password").
- Adding further local accounts does **not** prompt for a new password — it encrypts under the
  session-unlocked master password. Trade-off: all local accounts share one password (accepted).
- **Unlock** = try to `decryptStringFromStorage` any vault entry with the entered password; if it
  succeeds the password is correct and becomes the session master. The migrated account is the
  verification anchor.

### Seamless migration (no re-encryption, no password prompt)

On first load of the new version, reshape storage silently — it only moves **ciphertext**, so
no password is required:

```
read aryxn:account (ciphertext) ─move→ aryxn:vault[id] = same ciphertext (verbatim)
                                        aryxn:accounts = [{ id, type:"local", chain:"arweave", address, label }]
                                        aryxn:active   = id
delete aryxn:account
```

The user's unlock password is unchanged (`decryptStringFromStorage(vault[id], P)` — same
function, same ciphertext). Nothing is re-keyed; upgrading is invisible until the user unlocks
to use the account (exactly as before).

---

## 5. Reactive State & Module Boundaries

Refactor the single-account `account.ts` into a dedicated store `accounts.ts` that owns ranui
signals and exposes a clean API. `pages/*` become pure views over these signals.

```ts
// accounts.ts (owns reactive signals)
accounts(): AccountRecord[]           // reactive book
activeId(): string | null
activeAccount(): AccountRecord | null // derived

setActive(id): Promise<void>
addLocal(): Promise<AccountRecord>            // uses session master password
importLocal(jwkJson): Promise<AccountRecord>
connectWander(): Promise<AccountRecord>
connectEvm(provider, address): Promise<AccountRecord>
removeAccount(id): void

unlockVault(masterPassword): Promise<void>
isVaultUnlocked(): boolean
lockVault(): void
activeJwk(): ArweaveJWK | null        // signer for the active local account
migrateLegacy(): void                 // §4, run once on load
```

Module map:

- `accounts.ts` — book + vault + active pointer + switching (this file replaces `account.ts`).
- `balances.ts` — per-address balance fetch + cache signal (§7).
- `cache.ts` — add `owner` filtering (§6).
- `storage.ts` — `AssetRecord.owner`, stamped on upload and reconcile (§6).
- `pages/home.ts`, `pages/accounts.ts`, `pages/viewer.ts` — route views (§8).
- `main.ts` — app shell + router (§8).

---

## 6. Resource Scoping (fixes pain point ②)

Add an owner to every cached record and filter the view by the active account's address.

```ts
interface AssetRecord { /* …existing… */ owner: string }
```

- On upload: `owner = uploading account address` (AR address for `arweave`, EVM address for `irys`).
- On reconcile: `listArweaveByOwner(a)` / `listIrysByOwner(evm)` are already per-address → stamp
  `owner` with that address.
- `cachedAssets(owner)` filters by owner; the "my links" view reads `cachedAssets(activeAccount.address)`.

Result: switching to an Arweave account shows only its Arweave resources; switching to an EVM
account shows only its Irys resources — one cache, cleanly sliced by account.

**Legacy cache self-heal**: old records have no `owner`. They are re-stamped on the next
successful network reconcile of that owner. Until then, a legacy (owner-less) record is shown
when its `chain` matches the active account's chain — so nothing disappears, and cross-account
leakage is negligible because the old app was effectively single-account. No cache wipe needed.

---

## 7. Balances & Upload Usage

**Balances** — lazy, best-effort, cached in a `balances` signal map keyed by address:

- Arweave accounts (`local` / `wander`): reuse `getArBalance(address)` (winston → AR).
- EVM accounts: read native balance from the injected provider (`eth_getBalance` →
  `ethers.formatEther`), labeled with the chain's native symbol (fallback "ETH"). Silent on failure.
- Refresh on account switch and on opening `/accounts`; a manual refresh control is provided.

**Upload usage** — pure local derivation, zero extra requests:

- Per account: reduce the owner-filtered records → `{ count, totalBytes }` from
  `cachedAssets(owner)`. Reflects "known uploads"; completeness self-heals with reconcile.

---

## 8. Routing, Nav Quick-Switch, Accounts Page

Adopt ranui's router and split the app into pages (isolation). A persistent shell renders the
nav once (so the account switcher is always present); routes swap only the main content, each
in its own `createRoot`, disposed on navigation.

```
Shell (persistent): nav (with account switcher) + <route outlet> + account modal
Routes (hash mode):
  #/                        → pages/home.ts     uploader + my links
  #/accounts                → pages/accounts.ts account management (new)
  #/view/<chain>/<tx>/<key> → pages/viewer.ts   decrypt viewer (existing, moved)
```

**Nav quick-switch** — the connect button becomes an account switcher (`r-dropdown`, Geist):

```
[● abcd…12 · 1.24 AR ▾]
 └─ ● abcd…12   local   1.24 AR
    ○ Wander    ext     0.80 AR
    ○ 9f3a…7b   evm     0.05 ETH
    ───────────────────────────
    + create / import / connect Wander / connect EVM
    ⚙ Manage accounts →  (/accounts)
```

**Accounts page `/accounts`**:

- Header: title + "Add account" (create local / import keyfile / connect Wander / connect EVM).
- List row: ● active marker · label · type badge (local/ext/evm) · address (mono, copy) · balance
  · usage (N files · X MB). Click row = switch. Local rows also: backup (export / encrypted
  export), remove.
- Vault lock state: when locked, a top banner with a master-password field to unlock before
  managing local accounts. Everything is reactive over the `accounts.ts` signals.

---

## 9. Upload Signer Resolution

Keep upload behavior close to current, sourcing the signer from the active account:

- **Arweave**: if the active account is Arweave (`local` → `activeJwk()`; `wander` → external),
  use it. If the active account is EVM, prompt to pick/add an Arweave account.
- **Irys**: if the active account is EVM, use it; otherwise fall back to the existing EIP-6963
  discovery flow.

---

## 10. Error Handling & Edge Cases

- **Wrong master password** on unlock → decrypt fails → inline error on the unlock field ("Wrong
  password"), no state change.
- **Remove active account** → clear active pointer, fall back to the next account (or "no account"
  empty state); local removal also deletes its vault entry (irreversible without a backup — confirm).
- **EVM address changes** in the wallet (account/chain switch) → re-read on focus/`accountsChanged`;
  the `evm` record's address updates and resources re-scope.
- **Balance fetch failure / offline** → leave balance blank (best-effort); cached links still show.
- **Legacy records without owner** → §6 self-heal; same-chain fallback prevents disappearance.
- **Vault locked while switching to a local account** → prompt master password once per session.

---

## 11. Testing / Verification

- Unit-testable `accounts.ts`: migration from a single-slot fixture; unlock success/failure;
  add/import/remove; active-pointer transitions; `activeJwk()` correctness.
- `cache.ts`: owner filtering; legacy self-heal (owner-less same-chain fallback).
- Manual/e2e in light **and** dark, narrow **and** wide: switch accounts and confirm the links
  list, balance, and usage all re-scope; migrate an existing single-account profile and confirm
  the old unlock password still works with no re-setup.

---

## 12. Backward Compatibility Summary

- Existing single account migrates silently (ciphertext moved, no password prompt, no re-key).
- Old unlock password continues to work unchanged (same crypto primitive).
- Existing cached links self-heal their `owner` on next reconcile; no cache wipe.
- The `#/view/...` viewer route and its link format are preserved.
