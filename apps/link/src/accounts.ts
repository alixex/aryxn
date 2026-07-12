// Account book store: types, storage keys, and reactive state.
// Replaces the single-account `account.ts` (see Task 4/5 of the multi-account
// plan for migration, CRUD, and vault unlock/lock logic built on top of this).

import { signal, computed } from "ranui/builder"
import { arweave, type ArweaveJWK } from "@alixex/arweave"
import { decryptStringFromStorage } from "@alixex/crypto"

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

function writeJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

/** The vault maps account id -> the encrypted-keyfile ciphertext blob (as stored, verbatim). */
type Vault = Record<string, string>

// Seeded once from localStorage at module load, then held in-memory and only
// ever mutated through writeVault (mirrors the accounts/activeId signals
// above, which are likewise seeded once and never re-read from disk).
let vaultCache: Vault = readJSON<Vault>(VAULT_KEY, {})

function readVault(): Vault {
  return vaultCache
}

function writeVault(vault: Vault): void {
  vaultCache = vault
  writeJSON(VAULT_KEY, vault)
}

function shorten(address: string): string {
  return address.length > 10
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address
}

function newId(): string {
  return crypto.randomUUID()
}

// ── Reactive state ─────────────────────────────────────────────────────────
const [accounts, setAccounts] = signal<AccountRecord[]>(
  readJSON(ACCOUNTS_KEY, []),
)
const [activeId, setActiveId] = signal<string | null>(
  localStorage.getItem(ACTIVE_KEY),
)
export { accounts, activeId }
export const activeAccount = computed<AccountRecord | null>(
  () => accounts().find((a) => a.id === activeId()) ?? null,
)

function persistAccounts(next: AccountRecord[]): void {
  setAccounts(next)
  writeJSON(ACCOUNTS_KEY, next)
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

// ── Legacy migration + unlock ───────────────────────────────────────────────

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
