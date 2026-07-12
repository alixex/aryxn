# Multi-Account Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve `apps/link` from a single active account to a multi-account book with switching, per-account resource isolation, and a per-account assets view (balance + upload usage), plus a `/accounts` page and a nav account switcher.

**Architecture:** A framework-free ranui SPA. A new `accounts.ts` store owns the account book (localStorage) and ranui signals; local keyfiles are encrypted under one master password (Scheme A) reusing the existing crypto primitive so the current single account migrates with no re-encryption. Cached links gain an `owner` so the "my links" view scopes per active account. A small hash router splits the app into a persistent shell + `home` / `accounts` / `viewer` pages.

**Tech Stack:** TypeScript, Vite 8, ranui (Geist Web Components + reactive builder), `@alixex/arweave`, `@alixex/crypto`, ethers v6, `@irys/web-upload`. Tests: Vitest (happy-dom) for pure-logic modules.

**Spec:** `docs/superpowers/specs/2026-07-12-multi-account-design.md`

**Branch:** `feature/multi-account` (already created).

---

## Deliberate refinements over the spec (call-outs)

- **Nav switcher** shows the account-switch list + a single **"Manage accounts →"** entry that routes to `/accounts`; all add / import / connect / unlock / remove flows live on the `/accounts` page (not inline in the dropdown). Keeps the dropdown simple; the page is the one place management happens. Faithful to the spec's goal.
- The existing account **modal is removed** — the `/accounts` page replaces it.

---

## File Structure

**New files**
- `apps/link/src/accounts.ts` — account book store: types (`AccountRecord`, `Network`, `ASSET_CHAIN`), ranui signals (`accounts`, `activeId`, `activeAccount`), migration, vault unlock/lock, CRUD, `setActive`, `activeJwk`. Replaces `account.ts`.
- `apps/link/src/balances.ts` — per-address balance fetch (AR + EVM) into a `balances` signal map; `usageFor(records)` reduction.
- `apps/link/src/router.ts` — hash router using ranui's createRoot-per-page pattern; renders the matched page into an outlet, disposing the previous page.
- `apps/link/src/shell.ts` — persistent shell: nav (brand, theme switch, lang, account switcher) + route outlet. Hosts the router.
- `apps/link/src/pages/home.ts` — home page (uploader + my links); the bulk of current `app.ts`.
- `apps/link/src/pages/accounts.ts` — account management page.
- `apps/link/src/pages/viewer.ts` — moved from `apps/link/src/viewer.ts`.
- `apps/link/src/accounts.test.ts`, `apps/link/src/cache.test.ts`, `apps/link/src/balances.test.ts` — Vitest unit tests.
- `apps/link/vitest.config.ts` — Vitest config.

**Modified files**
- `apps/link/src/storage.ts` — `AssetRecord.owner`; `makeRecord` owner param; upload fns pass owner; list fns stamp owner.
- `apps/link/src/cache.ts` — `cachedAssets(owner?)` filter.
- `apps/link/src/main.ts` — bootstrap shell + router.
- `apps/link/src/index.html` — styles for the switcher dropdown and accounts page.
- `apps/link/src/locales/en.ts`, `apps/link/src/locales/zh-CN.ts` — new strings.
- `apps/link/package.json` — vitest devDeps + `test` script.

**Deleted files**
- `apps/link/src/account.ts` (subsumed by `accounts.ts`).
- `apps/link/src/app.ts` (split into `shell.ts` + `pages/home.ts`).
- `apps/link/src/viewer.ts` (moved to `pages/viewer.ts`).

---

## Phase 0 — Test harness

### Task 0: Add Vitest (happy-dom)

**Files:**
- Modify: `apps/link/package.json`
- Create: `apps/link/vitest.config.ts`
- Create: `apps/link/src/smoke.test.ts`

- [ ] **Step 1: Add devDeps + script**

In `apps/link/package.json` add to `devDependencies`: `"vitest": "^3.2.0"`, `"happy-dom": "^15.11.0"`. Add to `scripts`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: adds vitest + happy-dom to the workspace.

- [ ] **Step 3: Create `apps/link/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "happy-dom", // provides localStorage + WebCrypto for the store tests
    include: ["src/**/*.test.ts"],
  },
})
```

- [ ] **Step 4: Create `apps/link/src/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest"

describe("harness", () => {
  it("has localStorage", () => {
    localStorage.setItem("k", "v")
    expect(localStorage.getItem("k")).toBe("v")
  })
})
```

- [ ] **Step 5: Run + commit**

Run: `pnpm --filter=@alixex/link test`
Expected: 1 passed.

```bash
git add apps/link/package.json apps/link/vitest.config.ts apps/link/src/smoke.test.ts pnpm-lock.yaml
git commit -m "test: add vitest (happy-dom) harness to link app"
```

---

## Phase 1 — Data model & storage

### Task 1: `AssetRecord.owner`

**Files:**
- Modify: `apps/link/src/storage.ts` (interface `AssetRecord`; `makeRecord`; `uploadArweave`; `uploadIrys`; `listArweaveByOwner`; `listIrysByOwner`)

- [ ] **Step 1: Add `owner` to the interface**

In `AssetRecord` (storage.ts ~line 19) add:

```ts
  /** The address that uploaded this asset — AR address for arweave, EVM address for irys. */
  owner: string
```

- [ ] **Step 2: Thread `owner` through `makeRecord`**

Change `makeRecord`'s signature and return:

```ts
function makeRecord(
  chain: Chain,
  txId: string,
  file: File,
  size: number,
  owner: string,
  encKey?: string,
): AssetRecord {
  return {
    txId,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    size,
    timestamp: Date.now(),
    chain,
    url: encKey ? viewerLink(chain, txId, encKey) : `${chainGateway(chain)}/${txId}`,
    encrypted: !!encKey,
    encKey,
    owner,
  }
}
```

- [ ] **Step 3: Pass owner from the upload functions**

In `uploadArweave`, the final return becomes:

```ts
  return makeRecord("arweave", txId, file, finalSize, ownerAddress, encKey)
```

In `uploadIrys`, add an `ownerAddress` derivation before the return. After the uploader is built, read the paying address from the provider and pass it:

```ts
  const evmAddress: string = await provider.getSigner().then((s) => s.getAddress())
  // …existing upload…
  return makeRecord("irys", receipt.id, file, data.length, evmAddress, encKey)
```

- [ ] **Step 4: Stamp owner in the list functions**

In `listArweaveByOwner`'s `.map`, add `owner: address,` to the returned record. In `listIrysByOwner`'s `.map`, add `owner: address,` to the returned record.

- [ ] **Step 5: Verify types + commit**

Run: `pnpm --filter=@alixex/link type-check`
Expected: passes (existing `makeRecord` calls updated).

```bash
git add apps/link/src/storage.ts
git commit -m "feat(storage): add owner to AssetRecord and stamp it on upload/reconcile"
```

### Task 2: `cachedAssets(owner?)` filter

**Files:**
- Modify: `apps/link/src/cache.ts`
- Test: `apps/link/src/cache.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest"

// idb is IndexedDB-backed; mock it so cache logic is tested in isolation.
const store = new Map<string, unknown>()
vi.mock("@alixex/storage", () => ({
  idbSet: vi.fn(async (k: string, v: unknown) => void store.set(k, v)),
  idbValues: vi.fn(async () => [...store.values()]),
}))

import { cachedAssets, cacheAsset } from "./cache"
import type { AssetRecord } from "./storage"

const rec = (txId: string, owner: string, chain: "arweave" | "irys" = "arweave"): AssetRecord => ({
  txId, fileName: txId, contentType: "text/plain", size: 1, timestamp: 1, chain,
  url: "u", owner,
})

describe("cachedAssets(owner)", () => {
  beforeEach(() => store.clear())

  it("returns all records when no owner is given", async () => {
    await cacheAsset(rec("a", "OWNER1"))
    await cacheAsset(rec("b", "OWNER2"))
    expect((await cachedAssets()).length).toBe(2)
  })

  it("filters by owner when given", async () => {
    await cacheAsset(rec("a", "OWNER1"))
    await cacheAsset(rec("b", "OWNER2"))
    const mine = await cachedAssets("OWNER1")
    expect(mine.map((r) => r.txId)).toEqual(["a"])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter=@alixex/link test src/cache.test.ts`
Expected: FAIL — `cachedAssets` doesn't accept an owner yet.

- [ ] **Step 3: Implement the filter**

Change `cachedAssets` in cache.ts:

```ts
export async function cachedAssets(owner?: string): Promise<AssetRecord[]> {
  const all = await idbValues<AssetRecord>()
  return all
    .filter((v): v is AssetRecord => !!v && typeof v.txId === "string")
    .filter((v) => !owner || v.owner === owner)
    .sort((a, b) => b.timestamp - a.timestamp)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter=@alixex/link test src/cache.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/link/src/cache.ts apps/link/src/cache.test.ts
git commit -m "feat(cache): filter cached assets by owner"
```

---

## Phase 2 — Accounts store

> The store reuses the exact crypto primitive from the old `account.ts`: local keyfiles are stored as `JSON.stringify(await encryptStringForStorage(JSON.stringify(jwk), pw))`, and decrypted via `decryptStringFromStorage(JSON.parse(blob), pw)`. This is what makes migration a verbatim ciphertext move.

### Task 3: Store scaffolding — types, storage keys, signals, persistence

**Files:**
- Create: `apps/link/src/accounts.ts`

- [ ] **Step 1: Create the module with types, keys, signals, and private helpers**

```ts
import { signal, computed } from "ranui/builder"
import { arweave, generateArweaveWallet, type ArweaveJWK } from "@alixex/arweave"
import { encryptStringForStorage, decryptStringFromStorage } from "@alixex/crypto"
import { connectArweave } from "./wallet"

export type Network = "arweave" | "evm"
export type AccountType = "local" | "wander" | "evm"

export interface AccountRecord {
  id: string
  type: AccountType
  network: Network
  address: string
  label: string
  createdAt: number
}

/** Map an account's network to the chain its assets are stored on. */
export const ASSET_CHAIN = { arweave: "arweave", evm: "irys" } as const

const ACCOUNTS_KEY = "aryxn:accounts"
const ACTIVE_KEY = "aryxn:active"
const VAULT_KEY = "aryxn:vault"
const LEGACY_KEY = "aryxn:account"
const PLACEHOLDER_LABEL = "Local account"

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeJSON(key: string, val: unknown): void {
  localStorage.setItem(key, JSON.stringify(val))
}
function readVault(): Record<string, string> {
  return readJSON<Record<string, string>>(VAULT_KEY, {})
}
function writeVault(v: Record<string, string>): void {
  writeJSON(VAULT_KEY, v)
}
function shorten(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 5)}…${addr.slice(-4)}` : addr
}
function newId(): string {
  return crypto.randomUUID()
}

// ── Reactive state ─────────────────────────────────────────────────────────
const [accounts, setAccounts] = signal<AccountRecord[]>(readJSON(ACCOUNTS_KEY, []))
const [activeId, setActiveId] = signal<string | null>(localStorage.getItem(ACTIVE_KEY))
export { accounts, activeId }
export const activeAccount = computed<AccountRecord | null>(
  () => accounts().find((a) => a.id === activeId()) ?? null,
)

function persistAccounts(list: AccountRecord[]): void {
  setAccounts(list)
  writeJSON(ACCOUNTS_KEY, list)
}
function persistActive(id: string | null): void {
  setActiveId(id)
  if (id) localStorage.setItem(ACTIVE_KEY, id)
  else localStorage.removeItem(ACTIVE_KEY)
}

// ── Session (never persisted) ──────────────────────────────────────────────
let masterPw: string | null = null
const jwkCache = new Map<string, ArweaveJWK>()

export function isVaultUnlocked(): boolean {
  return masterPw !== null
}
export function lockVault(): void {
  masterPw = null
  jwkCache.clear()
}
export function activeJwk(): ArweaveJWK | null {
  const a = activeAccount()
  return a && a.type === "local" ? (jwkCache.get(a.id) ?? null) : null
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter=@alixex/link type-check`
Expected: passes (module has no consumers yet; unused `generateArweaveWallet`/`connectArweave`/`encrypt*` imports are added in later tasks — if the linter flags unused imports, proceed to Task 4/6 which use them, or temporarily add them in the same commit).

- [ ] **Step 3: Commit**

```bash
git add apps/link/src/accounts.ts
git commit -m "feat(accounts): store scaffolding — types, keys, signals"
```

### Task 4: Legacy migration + vault unlock (verify anchor, backfill each, skip corrupt)

**Files:**
- Modify: `apps/link/src/accounts.ts`
- Test: `apps/link/src/accounts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest"

// Deterministic, fast doubles for the crypto + arweave deps.
vi.mock("@alixex/crypto", () => ({
  // "encrypt" = wrap; "decrypt" = unwrap iff pw matches, else throw.
  encryptStringForStorage: vi.fn(async (plain: string, pw: string) => ({ pw, plain })),
  decryptStringFromStorage: vi.fn(async (enc: { pw: string; plain: string }, pw: string) => {
    if (enc.pw !== pw) throw new Error("bad pw")
    return enc.plain
  }),
}))
vi.mock("@alixex/arweave", () => ({
  arweave: { wallets: { jwkToAddress: vi.fn(async (jwk: { n: string }) => `addr_${jwk.n}`) } },
  generateArweaveWallet: vi.fn(async () => ({ key: { kty: "RSA", n: "NEW" } })),
}))
vi.mock("./wallet", () => ({ connectArweave: vi.fn(async () => "WANDER_ADDR") }))

import {
  migrateLegacy,
  unlockVault,
  isVaultUnlocked,
  accounts,
  activeAccount,
  activeJwk,
} from "./accounts"

// The legacy blob format equals the old account.ts: JSON.stringify(encryptStringForStorage(jwkJson, pw)).
function legacyBlob(jwk: object, pw: string): string {
  return JSON.stringify({ pw, plain: JSON.stringify(jwk) })
}

describe("migration + unlock", () => {
  beforeEach(() => {
    localStorage.clear()
    // reset module singletons by reimporting is complex; instead assert on a fresh key set per test
  })

  it("migrates the legacy single account into the book, locked (empty address)", () => {
    localStorage.setItem("aryxn:account", legacyBlob({ kty: "RSA", n: "OLD" }, "P"))
    migrateLegacy()
    expect(localStorage.getItem("aryxn:account")).toBeNull()
    const list = accounts()
    expect(list.length).toBe(1)
    expect(list[0].type).toBe("local")
    expect(list[0].address).toBe("") // locked until unlock
    expect(activeAccount()?.id).toBe(list[0].id)
    // vault holds the ciphertext verbatim
    const vault = JSON.parse(localStorage.getItem("aryxn:vault")!)
    expect(vault[list[0].id]).toBe(legacyBlob({ kty: "RSA", n: "OLD" }, "P"))
  })

  it("unlock with the old password backfills the address and caches the jwk", async () => {
    await unlockVault("P")
    expect(isVaultUnlocked()).toBe(true)
    expect(activeAccount()?.address).toBe("addr_OLD")
    expect(activeJwk()).toEqual({ kty: "RSA", n: "OLD" })
  })

  it("unlock with a wrong password throws and does not unlock", async () => {
    localStorage.clear()
    localStorage.setItem("aryxn:vault", JSON.stringify({ id1: legacyBlob({ kty: "RSA", n: "X" }, "RIGHT") }))
    localStorage.setItem(
      "aryxn:accounts",
      JSON.stringify([{ id: "id1", type: "local", network: "arweave", address: "", label: "Local account", createdAt: 1 }]),
    )
    await expect(unlockVault("WRONG")).rejects.toThrow()
  })
})
```

> Note: module-level signal singletons persist across tests in one file. Order the tests so migration runs before unlock (as written), and use a fresh `localStorage` key set in the wrong-password test. If cross-test state proves flaky, split into separate files.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter=@alixex/link test src/accounts.test.ts`
Expected: FAIL — `migrateLegacy` / `unlockVault` not exported yet.

- [ ] **Step 3: Implement migration + unlock in accounts.ts**

```ts
/** One-time reshape of the old single-slot account into the book. Moves ciphertext only. */
export function migrateLegacy(): void {
  const legacy = localStorage.getItem(LEGACY_KEY)
  if (!legacy) return
  const id = newId()
  const vault = readVault()
  vault[id] = legacy // verbatim ciphertext
  writeVault(vault)
  const rec: AccountRecord = {
    id,
    type: "local",
    network: "arweave",
    address: "", // locked/unknown until first unlock
    label: PLACEHOLDER_LABEL,
    createdAt: Date.now(),
  }
  persistAccounts([rec, ...accounts()])
  persistActive(id)
  localStorage.removeItem(LEGACY_KEY)
}

async function backfillAddress(id: string, jwk: ArweaveJWK): Promise<void> {
  const address = await arweave.wallets.jwkToAddress(jwk)
  persistAccounts(
    accounts().map((a) =>
      a.id === id
        ? { ...a, address, label: a.label === PLACEHOLDER_LABEL ? shorten(address) : a.label }
        : a,
    ),
  )
}

/** Verify with any one entry, then decrypt + backfill each; skip corrupt blobs. */
export async function unlockVault(pw: string): Promise<void> {
  const vault = readVault()
  const entries = Object.entries(vault)
  let ok = 0
  for (const [id, blob] of entries) {
    try {
      const jwk = JSON.parse(await decryptStringFromStorage(JSON.parse(blob), pw)) as ArweaveJWK
      jwkCache.set(id, jwk)
      await backfillAddress(id, jwk)
      ok++
    } catch {
      /* corrupt or wrong-pw entry — leave it locked */
    }
  }
  if (entries.length > 0 && ok === 0) throw new Error("Wrong password")
  masterPw = pw
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter=@alixex/link test src/accounts.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/link/src/accounts.ts apps/link/src/accounts.test.ts
git commit -m "feat(accounts): legacy migration + master-password unlock with address backfill"
```

### Task 5: CRUD + setActive

**Files:**
- Modify: `apps/link/src/accounts.ts`
- Test: `apps/link/src/accounts.test.ts` (append)

- [ ] **Step 1: Append failing tests**

```ts
import { addLocal, importLocal, connectEvm, removeAccount, setActive, activeId } from "./accounts"

describe("crud", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("addLocal establishes the master password on the first account", async () => {
    const rec = await addLocal("MASTER")
    expect(rec.type).toBe("local")
    expect(rec.address).toBe("addr_NEW")
    expect(accounts().some((a) => a.id === rec.id)).toBe(true)
  })

  it("connectEvm dedupes by address (case-insensitive)", () => {
    const a = connectEvm("0xABC")
    const b = connectEvm("0xabc")
    expect(a.id).toBe(b.id)
    expect(a.network).toBe("evm")
  })

  it("removeAccount re-derives the active pointer", async () => {
    const first = await addLocal("MASTER")
    const second = connectEvm("0xDEF")
    await setActive(second.id)
    expect(activeId()).toBe(second.id)
    removeAccount(second.id)
    expect(activeId()).toBe(first.id) // fell back to remaining account
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter=@alixex/link test src/accounts.test.ts`
Expected: FAIL — CRUD functions not exported.

- [ ] **Step 3: Implement CRUD + setActive**

```ts
async function persistLocal(jwk: ArweaveJWK, pw: string): Promise<AccountRecord> {
  const address = await arweave.wallets.jwkToAddress(jwk)
  const id = newId()
  const blob = JSON.stringify(await encryptStringForStorage(JSON.stringify(jwk), pw))
  const vault = readVault()
  vault[id] = blob
  writeVault(vault)
  jwkCache.set(id, jwk)
  const rec: AccountRecord = {
    id,
    type: "local",
    network: "arweave",
    address,
    label: shorten(address),
    createdAt: Date.now(),
  }
  persistAccounts([...accounts(), rec])
  return rec
}

/** Create a new local account. `password` is required only for the first account (sets the master). */
export async function addLocal(password?: string): Promise<AccountRecord> {
  const pw = resolveMaster(password)
  const { key } = await generateArweaveWallet()
  return persistLocal(key as ArweaveJWK, pw)
}

/** Import an Arweave keyfile. `password` required only when establishing the master. */
export async function importLocal(jwkJson: string, password?: string): Promise<AccountRecord> {
  const pw = resolveMaster(password)
  let jwk: ArweaveJWK
  try {
    jwk = JSON.parse(jwkJson) as ArweaveJWK
  } catch {
    throw new Error("Invalid keyfile: not valid JSON")
  }
  if (!jwk || jwk.kty !== "RSA" || !jwk.n) throw new Error("Invalid keyfile: not an Arweave JWK")
  return persistLocal(jwk, pw)
}

/** Resolve the master password: use the session master, or establish it from `password` when the vault is empty. */
function resolveMaster(password?: string): string {
  if (masterPw !== null) return masterPw
  if (Object.keys(readVault()).length === 0 && password) {
    masterPw = password
    return password
  }
  throw new Error("VAULT_LOCKED") // caller must unlockVault() first
}

export async function connectWander(): Promise<AccountRecord> {
  const address = await connectArweave()
  const existing = accounts().find((a) => a.type === "wander" && a.address === address)
  if (existing) return existing
  const rec: AccountRecord = {
    id: newId(),
    type: "wander",
    network: "arweave",
    address,
    label: shorten(address),
    createdAt: Date.now(),
  }
  persistAccounts([...accounts(), rec])
  return rec
}

export function connectEvm(address: string): AccountRecord {
  const existing = accounts().find(
    (a) => a.type === "evm" && a.address.toLowerCase() === address.toLowerCase(),
  )
  if (existing) return existing
  const rec: AccountRecord = {
    id: newId(),
    type: "evm",
    network: "evm",
    address,
    label: shorten(address),
    createdAt: Date.now(),
  }
  persistAccounts([...accounts(), rec])
  return rec
}

export function removeAccount(id: string): void {
  const vault = readVault()
  if (vault[id]) {
    delete vault[id]
    writeVault(vault)
  }
  jwkCache.delete(id)
  const rest = accounts().filter((a) => a.id !== id)
  persistAccounts(rest)
  if (activeId() === id) persistActive(rest[0]?.id ?? null)
}

/** Switch active account. Throws "VAULT_LOCKED" if a local account needs unlocking first. */
export async function setActive(id: string): Promise<void> {
  const rec = accounts().find((a) => a.id === id)
  if (!rec) return
  if (rec.type === "local" && !jwkCache.has(id)) {
    if (masterPw === null) throw new Error("VAULT_LOCKED")
    // master set but not cached (rare) — try to decrypt this one entry
    const blob = readVault()[id]
    if (blob) {
      const jwk = JSON.parse(await decryptStringFromStorage(JSON.parse(blob), masterPw)) as ArweaveJWK
      jwkCache.set(id, jwk)
      if (!rec.address) await backfillAddress(id, jwk)
    }
  }
  if (rec.type === "wander") await connectArweave().catch(() => {})
  persistActive(id)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter=@alixex/link test src/accounts.test.ts`
Expected: PASS (all suites).

- [ ] **Step 5: Delete the old `account.ts` and update imports**

Delete `apps/link/src/account.ts`. It is imported by the (still present) `app.ts` as `import * as accounts from "./account"` and `import type { Account } from "./account"` — those references are removed when `app.ts` becomes `pages/home.ts` (Task 9). To keep this commit compiling, defer the delete to Task 9. **In this task, do not delete `account.ts` yet** — just commit the store CRUD.

```bash
git add apps/link/src/accounts.ts apps/link/src/accounts.test.ts
git commit -m "feat(accounts): CRUD (add/import/connect/remove) + setActive"
```

---

## Phase 3 — Balances & usage

### Task 6: `balances.ts`

**Files:**
- Create: `apps/link/src/balances.ts`
- Test: `apps/link/src/balances.test.ts`

- [ ] **Step 1: Write the failing test (usage reduction — the pure part)**

```ts
import { describe, it, expect } from "vitest"
import { usageFor } from "./balances"
import type { AssetRecord } from "./storage"

const rec = (size: number): AssetRecord => ({
  txId: String(size), fileName: "f", contentType: "t", size, timestamp: 1,
  chain: "arweave", url: "u", owner: "O",
})

describe("usageFor", () => {
  it("counts files and sums bytes", () => {
    expect(usageFor([rec(100), rec(400)])).toEqual({ count: 2, totalBytes: 500 })
  })
  it("handles empty", () => {
    expect(usageFor([])).toEqual({ count: 0, totalBytes: 0 })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter=@alixex/link test src/balances.test.ts`
Expected: FAIL — `usageFor` undefined.

- [ ] **Step 3: Implement `balances.ts`**

```ts
import { signal } from "ranui/builder"
import { getArBalance } from "./wallet"
import type { AssetRecord } from "./storage"
import type { AccountRecord } from "./accounts"

export interface Usage {
  count: number
  totalBytes: number
}

/** Pure reduction over an account's owner-filtered records. */
export function usageFor(records: AssetRecord[]): Usage {
  return records.reduce<Usage>(
    (u, r) => ({ count: u.count + 1, totalBytes: u.totalBytes + (r.size || 0) }),
    { count: 0, totalBytes: 0 },
  )
}

// address → "1.2345 AR" | "0.05 ETH" | null (loading/failed). Reactive.
const [balances, setBalances] = signal<Record<string, string | null>>({})
export { balances }

/** Best-effort: fetch and cache the native balance for an account. Silent on failure. */
export async function refreshBalance(acc: AccountRecord): Promise<void> {
  if (!acc.address) return
  try {
    if (acc.network === "arweave") {
      const ar = await getArBalance(acc.address)
      setBalances({ ...balances(), [acc.address]: `${ar} AR` })
    } else {
      const eth = (globalThis as unknown as {
        ethereum?: { request?: (a: { method: string; params: unknown[] }) => Promise<string> }
      }).ethereum
      if (!eth?.request) return
      const hex = await eth.request({ method: "eth_getBalance", params: [acc.address, "latest"] })
      const wei = BigInt(hex)
      const eth4 = (Number(wei) / 1e18).toFixed(4)
      setBalances({ ...balances(), [acc.address]: `${eth4} ETH` })
    }
  } catch {
    /* best-effort — leave undefined */
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter=@alixex/link test src/balances.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/link/src/balances.ts apps/link/src/balances.test.ts
git commit -m "feat(balances): per-account native balance + usage reduction"
```

---

## Phase 4 — Router, shell, and pages

> These tasks restructure the app. They have no DOM unit tests (ranui web components don't render under happy-dom); they are verified with `type-check`, `build`, and a headless-Chrome screenshot in light + dark. Screenshot recipe (production build): `pnpm --filter=@alixex/link build && (pnpm --filter=@alixex/link preview --port 4180 &) ` then `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --window-size=1100,1500 --virtual-time-budget=6000 --user-data-dir=<scratch>/cp --screenshot=<scratch>/shot.png http://localhost:4180/`.

### Task 7: Hash router

**Files:**
- Create: `apps/link/src/router.ts`

- [ ] **Step 1: Implement the router (ranui createRoot-per-page pattern)**

```ts
import { createRoot } from "ranui/builder"

export type PageRender = (host: HTMLElement, params: Record<string, string>) => void

interface Route {
  match: (hash: string) => Record<string, string> | null
  render: PageRender
}

/** Mount a hash router into `outlet`. Each page renders inside its own createRoot,
 *  disposed on navigation (ranui SPA pattern, BUILDER.md §3). */
export function mountRouter(outlet: HTMLElement, routes: Route[], fallback: PageRender): () => void {
  let dispose: (() => void) | null = null

  const run = (): void => {
    const hash = location.hash || "#/"
    dispose?.()
    for (const r of routes) {
      const params = r.match(hash)
      if (params) {
        dispose = createRoot((d) => {
          r.render(outlet, params)
          return d
        })
        return
      }
    }
    dispose = createRoot((d) => {
      fallback(outlet, {})
      return d
    })
  }

  window.addEventListener("hashchange", run)
  run()
  return () => {
    window.removeEventListener("hashchange", run)
    dispose?.()
  }
}

/** Exact-path matcher, e.g. matchPath("#/accounts"). */
export function matchPath(path: string): (hash: string) => Record<string, string> | null {
  return (hash) => (hash.replace(/\?.*$/, "") === path ? {} : null)
}

/** Viewer matcher: #/view/<chain>/<txId>/<key>. */
export function matchViewer(hash: string): Record<string, string> | null {
  const m = hash.match(/^#\/view\/(arweave|irys)\/([^/]+)\/(.+)$/)
  return m ? { chain: m[1], txId: m[2], key: m[3] } : null
}

export function navigate(path: string): void {
  location.hash = path
}
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm --filter=@alixex/link type-check`
Expected: passes.

```bash
git add apps/link/src/router.ts
git commit -m "feat(router): hash router with per-page createRoot lifecycle"
```

### Task 8: Move viewer to `pages/viewer.ts`

**Files:**
- Create: `apps/link/src/pages/viewer.ts` (moved)
- Delete: `apps/link/src/viewer.ts`

- [ ] **Step 1: Move the file and adapt to the `PageRender` signature**

`git mv apps/link/src/viewer.ts apps/link/src/pages/viewer.ts`. Update its imports (`./i18n` → `../i18n`, `./storage` → `../storage`). Export a `PageRender`-compatible entry:

```ts
export function renderViewerPage(host: HTMLElement, params: Record<string, string>): void {
  renderViewer(host, params.chain as Chain, params.txId, params.key)
}
```

Keep the existing `renderViewer` body (already updated to the new `.hero/.uploader` classes).

- [ ] **Step 2: Verify + commit**

Run: `pnpm --filter=@alixex/link type-check`
Expected: passes (no other file imports `./viewer` yet except main.ts, updated in Task 11).

```bash
git add apps/link/src/pages/viewer.ts
git rm apps/link/src/viewer.ts
git commit -m "refactor: move viewer to pages/viewer.ts"
```

### Task 9: Move home page to `pages/home.ts`

**Files:**
- Create: `apps/link/src/pages/home.ts` (from `app.ts`)
- Delete: `apps/link/src/app.ts`, `apps/link/src/account.ts`

- [ ] **Step 1: Create `pages/home.ts` from `app.ts`**

`git mv apps/link/src/app.ts apps/link/src/pages/home.ts`. Then edit:
- Fix relative imports (`./i18n` → `../i18n`, `./wallet` → `../wallet`, `./storage` → `../storage`, `./cache` → `../cache`, `./wallet-evm` → `../wallet-evm`).
- Replace `import * as accounts from "./account"` / `import type { Account } from "./account"` with the new store: `import { activeAccount, activeJwk, accounts as accountBook } from "../accounts"`.
- Delete the nav-building code (`themeSwitch`, `langBtn`, `connectBtn`, `nav`, `accountModal`, `openAccountModal`, `buildAccountBody`, `connectLabel`, `loadBalance`, `applyAccount`, `setModalOpen`, `runAccount`, `pwdField`, `downloadText`, `acctGroup`) — the shell (Task 10) and accounts page (Task 12) own account UI now.
- Rename `renderApp(root)` to a `PageRender`: `export function renderHome(host: HTMLElement): void { … }`, keeping the hero + uploader + trust + links sections. It renders into `host` (no nav here).
- Replace the local `account()` signal usage with the store's `activeAccount()`; `address()` becomes `activeAccount()?.address ?? null`; the upload's `accounts.activeJwk()` becomes `activeJwk()`.
- The "resource scoping" change: `refreshLinks()` now scopes to the active account. Replace its body:

```ts
async function refreshLinks(): Promise<void> {
  const acc = activeAccount()
  const owner = acc?.address ?? ""
  // Show owner-scoped cache immediately; legacy owner-less records of the matching chain still show.
  setLinks(visibleAssets(await cachedAssets(), acc))
  if (acc?.network === "arweave" && owner) {
    try { await cacheAssets(await listArweaveByOwner(owner)) } catch { /* offline */ }
  }
  if (acc?.network === "evm" && owner) {
    try { await cacheAssets(await listIrysByOwner(owner)) } catch { /* offline */ }
  }
  setLinks(visibleAssets(await cachedAssets(), acc))
}
```

Add the visibility helper (implements §6 self-heal with the `ASSET_CHAIN` map):

```ts
import { ASSET_CHAIN, type AccountRecord } from "../accounts"

function visibleAssets(all: AssetRecord[], acc: AccountRecord | null): AssetRecord[] {
  if (!acc || !acc.address) return []
  const chain = ASSET_CHAIN[acc.network]
  return all.filter((r) => r.owner === acc.address || (!r.owner && r.chain === chain))
}
```

- Re-scope on account switch: wrap the links effect to read `activeAccount()` so it re-runs on switch:

```ts
createEffect(() => {
  activeAccount() // dependency: re-scope when the active account changes
  void refreshLinks()
})
```

- The upload "connect first" branch (`if (chain() === "arweave" && !address())`) now routes to the accounts page instead of opening the modal: `navigate("#/accounts")` (import `navigate` from `../router`) plus a toast.

- [ ] **Step 2: Delete the obsolete files**

`git rm apps/link/src/account.ts` (subsumed by `accounts.ts`).

- [ ] **Step 3: Verify types (main.ts still references old symbols — expect errors here; fixed in Task 11)**

Run: `pnpm --filter=@alixex/link type-check`
Expected: errors only in `main.ts` (references `renderApp`/`./viewer`) — acceptable at this step; fixed in Task 11. If you prefer a green commit, do Task 9–11 as one commit.

- [ ] **Step 4: Commit (grouped with Task 10–11 if you want green type-check)**

```bash
git add apps/link/src/pages/home.ts
git rm apps/link/src/app.ts apps/link/src/account.ts
git commit -m "refactor: move home into pages/home.ts; scope links per active account"
```

### Task 10: Shell + nav account switcher

**Files:**
- Create: `apps/link/src/shell.ts`
- Modify: `apps/link/src/main.ts`

- [ ] **Step 1: Implement `shell.ts`**

Renders the persistent nav (brand, `r-theme-switch`, lang `r-button`, and the account switcher) plus a route outlet, and mounts the router. Uses `r-dropdown` for the switcher.

```ts
import { View, Div, Span, createRoot } from "ranui/builder"
import { setTheme } from "ranui/theme"
import { t, i18n } from "./i18n"
import { accounts, activeAccount, setActive } from "./accounts"
import { balances, refreshBalance } from "./balances"
import { mountRouter, matchPath, matchViewer, navigate } from "./router"
import { renderHome } from "./pages/home"
import { renderAccountsPage } from "./pages/accounts"
import { renderViewerPage } from "./pages/viewer"

export function mountShell(root: HTMLElement): void {
  createRoot(() => {
    const outlet = Div().build()

    const nav = View("header").class("nav").children(
      Div().class("nav-inner").children(
        Div().class("brand").text("aryxn").on("click", () => navigate("#/")),
        Div().class("nav-actions").children(
          buildThemeSwitch(),
          buildLangButton(),
          buildAccountSwitcher(),
        ),
      ),
    ).build()

    const onScroll = (): void => { nav.classList.toggle("scrolled", window.scrollY > 4) }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()

    root.replaceChildren(nav, Div().class("wrap").children(outlet).build())

    mountRouter(
      outlet,
      [
        { match: matchPath("#/accounts"), render: renderAccountsPage },
        { match: matchViewer, render: renderViewerPage },
      ],
      renderHome, // fallback = home
    )
  })
}
```

Helper builders in the same file:

```ts
function buildThemeSwitch(): HTMLElement {
  return View("r-theme-switch")
    .attr("label-system", t("theme.system"))
    .attr("label-light", t("theme.light"))
    .attr("label-dark", t("theme.dark"))
    .on("change", (e: Event) => {
      const theme = (e as CustomEvent<{ theme: string }>).detail?.theme
      if (theme) setTheme(theme as "system" | "light" | "dark")
    })
    .build()
}

function buildLangButton(): HTMLElement {
  return View("r-button")
    .attr("type", "text")
    .text(() => { activeAccount(); return t("lang.toggle") })
    .on("click", () => {
      i18n.setLocale(i18n.getLocale() === "en" ? "zh-CN" : "en")
      location.reload() // simplest reliable re-render of all pages on locale switch
    })
    .build()
}

function buildAccountSwitcher(): HTMLElement {
  // Trigger button: active label + balance (or "Connect" / "Locked").
  const trigger = View("r-button").attr("type", "contrast").text(() => {
    const a = activeAccount()
    if (!a) return t("connect")
    if (!a.address) return `${a.label} · ${t("account.locked")}`
    const bal = balances()[a.address]
    return bal ? `${a.label} · ${bal}` : a.label
  }).build()

  const list = Div().build()
  createEffectListRebuild(list) // rebuilds the dropdown body when accounts/balances change

  return View("r-dropdown").children(trigger, list).build()
}
```

Where `createEffectListRebuild` uses `createEffect` to render each account as a row (radio dot + label + type badge + balance) that calls `setActive(a.id)` on click (catching `VAULT_LOCKED` → `navigate("#/accounts")`), plus a final "Manage accounts →" row → `navigate("#/accounts")`. Refresh balances via `refreshBalance` for each account when the dropdown opens.

- [ ] **Step 2: Rewrite `main.ts`**

```ts
import "ranui/theme-switch"
import "ranui/button"
import "ranui/progress"
import "ranui/link"
import "ranui/checkbox"
import "ranui/input"
import "ranui/dropdown"
import "ranui/message"
import "ranui/style"
import "ranui/fonts"
import { initTheme, setTheme } from "ranui/theme"
import { migrateLegacy } from "./accounts"
import { mountShell } from "./shell"

initTheme()
setTheme("system")
migrateLegacy() // one-time reshape of the legacy single account

const root = document.getElementById("app")
if (root) mountShell(root)
```

(Removed: the manual `#/view` branch — the router handles it. Removed: `ranui/modal` import if the modal is fully gone; keep it only if the accounts page uses a confirm modal.)

- [ ] **Step 3: Verify + build + screenshot**

Run: `pnpm --filter=@alixex/link type-check && pnpm --filter=@alixex/link build`
Expected: both pass.
Then screenshot `/` (recipe above) in light + dark; confirm nav + switcher + home render.

- [ ] **Step 4: Commit**

```bash
git add apps/link/src/shell.ts apps/link/src/main.ts
git commit -m "feat(shell): persistent nav + account switcher + router mount"
```

### Task 11: Accounts page

**Files:**
- Create: `apps/link/src/pages/accounts.ts`
- Modify: `apps/link/src/index.html` (styles)
- Modify: `apps/link/src/locales/en.ts`, `apps/link/src/locales/zh-CN.ts`

- [ ] **Step 1: Add locale strings**

Append to `en.ts` (and Chinese equivalents to `zh-CN.ts`):

```ts
  "account.manage": "Accounts",
  "account.locked": "Locked",
  "account.unlockVault": "Unlock",
  "account.masterPassword": "Master password",
  "account.setMaster": "Set a master password",
  "account.addLocal": "Create local account",
  "account.remove": "Remove",
  "account.confirmRemove": "Remove this account? Local keys are erased — back up first.",
  "account.usage": "{count} files · ~{size}",
  "account.typeLocal": "local",
  "account.typeWander": "wander",
  "account.typeEvm": "evm",
  "nav.manageAccounts": "Manage accounts",
```

- [ ] **Step 2: Implement `pages/accounts.ts`**

`renderAccountsPage(host)` renders (reactively over `accounts()` / `activeAccount()` / `balances()` / vault-lock state):

- A header row: title `t("account.manage")` + add actions (`addLocal` / `importLocal` file+password / `connectWander` if `hasArweaveWallet()` / connect EVM via `discoverEvmWallets` → `connectEvm(address)`).
- A vault banner when `!isVaultUnlocked() && hasLocalAccounts`: master-password `r-input` + Unlock button → `unlockVault(pw)` (on error, show inline "Wrong password").
- The account list: each row = active dot (● if `activeAccount()?.id===a.id`) · label · type badge · address (mono, copy) · `balances()[a.address]` · usage. Click row → `setActive(a.id)` (catch `VAULT_LOCKED` → focus the vault banner). Local rows: backup (export / encrypted export via the existing keyfile export code moved here) + remove (`removeAccount` after a confirm).
- On mount: for each account with an address, call `refreshBalance(acc)`; compute usage via `usageFor(await cachedAssets(acc.address))`.

Reuse the `.acct*` classes already in `index.html` for form groups. Use `createEffect` to rebuild the list on state change; keep imperative rebuilds out of getter bindings (BUILDER.md: build with plain values + explicit effects).

- [ ] **Step 3: Add CSS for the accounts page + switcher dropdown**

In `index.html` `<style>`, add classes: `.acct-page`, `.acct-row` (grid: dot · meta · balance · usage · actions), `.acct-badge`, `.acct-dot`, `.switcher-item`, using only semantic ranui tokens (`--ran-color-*`, `--ran-radius-*`, `--ran-shadow-menu` for the dropdown). Follow the existing `.link-item` / `.badge` patterns. Every color must be a `var(--ran-*)` token (no light-only literals) — grep-verify with: `grep -nE '#[0-9a-fA-F]{3,6}|rgb' apps/link/index.html | grep -v 'var(--ran' | grep -v 'data:image'` returns only the existing icon data-URIs.

- [ ] **Step 4: Verify + build + screenshot**

Run: `pnpm --filter=@alixex/link type-check && pnpm --filter=@alixex/link test && pnpm --filter=@alixex/link build`
Expected: all pass.
Screenshot `#/accounts` in light + dark; confirm list, badges, balances, vault banner render and re-scope on switch.

- [ ] **Step 5: Commit**

```bash
git add apps/link/src/pages/accounts.ts apps/link/index.html apps/link/src/locales/en.ts apps/link/src/locales/zh-CN.ts
git commit -m "feat(accounts-page): management page with switch, balance, usage, backup, remove"
```

---

## Phase 5 — Integration & final verification

### Task 12: Upload signer resolution from the active account

**Files:**
- Modify: `apps/link/src/pages/home.ts`

- [ ] **Step 1: Update `doUpload` signer resolution**

- Arweave: require `activeAccount()?.network === "arweave"`; use `activeJwk()` (local) or `null` (wander → external). If the active account is EVM, toast + `navigate("#/accounts")`.
- Irys: if `activeAccount()?.network === "evm"`, use its connected provider; else fall back to the existing `resolveEvmProvider()` (EIP-6963).

Show the exact code with the branch, mirroring the current `doUpload` but sourcing from `activeAccount()`.

- [ ] **Step 2: Verify + build**

Run: `pnpm --filter=@alixex/link type-check && pnpm --filter=@alixex/link build`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/link/src/pages/home.ts
git commit -m "feat(upload): resolve the signer from the active account"
```

### Task 13: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Type-check, tests, build**

Run: `pnpm --filter=@alixex/link type-check && pnpm --filter=@alixex/link test && pnpm --filter=@alixex/link build`
Expected: all green.

- [ ] **Step 2: Migration smoke test (manual, headless)**

Seed a legacy account and confirm it migrates + unlocks with the old password:
- In a preview session, `localStorage.setItem("aryxn:account", <an old-format blob>)`, reload, open `#/accounts`, confirm one locked account appears, unlock with its password, confirm the address + balance resolve and its links show. (Use the seed-page technique from earlier for headless, or verify manually in a normal browser.)

- [ ] **Step 3: Light + dark, narrow + wide**

Screenshot `/` and `#/accounts` at 1100px and 390px in light + dark; confirm no horizontal scroll, all tokens flip, switcher + list legible.

- [ ] **Step 4: Final commit (if any verification tweaks)**

```bash
git add -A
git commit -m "chore: multi-account verification tweaks"
```

---

## Self-Review

**Spec coverage:**
- §2 model → Task 3 (types, `ASSET_CHAIN`). §3 storage → Task 3 (keys, persistence). §4 password/migration → Task 4 (migrate + unlock + backfill), Task 5 (`resolveMaster`). §5 store API → Tasks 3–5. §6 owner scoping → Task 1 (owner), Task 2 (filter), Task 9 (`visibleAssets` self-heal). §7 balance/usage → Task 6. §8 routing/shell/accounts page → Tasks 7–11. §9 upload signer → Task 12. §10 edge cases → covered across Tasks 4/5/9/11 (unlock error, remove re-derive, add-while-locked via `resolveMaster` throw, locked switcher label in Task 10). §11 testing → Tasks 2/4/5/6 unit + Task 13 manual. §12 back-compat → Task 4 migration.

**Placeholder scan:** UI tasks (10/11/12) describe structure + key snippets rather than every line, because they follow existing `index.html`/`home.ts` patterns already in the repo and are design-driven; each has concrete acceptance (`type-check`/`build`/screenshot) and exact file paths. No `TODO`/`TBD` markers.

**Type consistency:** `AccountRecord` fields (`id/type/network/address/label/createdAt`), `Network` (`arweave|evm`), `ASSET_CHAIN` (`arweave→arweave, evm→irys`), and function names (`migrateLegacy`, `unlockVault`, `addLocal(password?)`, `importLocal(jwkJson, password?)`, `connectWander`, `connectEvm(address)`, `removeAccount`, `setActive`, `activeJwk`, `activeAccount`, `accounts`, `activeId`, `usageFor`, `refreshBalance`, `balances`, `renderHome`, `renderAccountsPage`, `renderViewerPage`, `mountShell`, `mountRouter`, `navigate`) are used consistently across tasks.

**Known limitation carried from spec (not a gap):** Irys reconciled records report `size: 0`, so per-account `totalBytes` under-reports for Irys links fetched from the network (§7 caveat); the usage label reads "~X".
