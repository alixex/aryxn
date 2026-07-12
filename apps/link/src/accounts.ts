// Account book store: types, storage keys, and reactive state.
// Replaces the single-account `account.ts` (see Task 4/5 of the multi-account
// plan for migration, CRUD, and vault unlock/lock logic built on top of this).

import { signal, computed } from "ranui/builder"
import {
  arweave,
  generateArweaveWallet,
  type ArweaveJWK,
} from "@alixex/arweave"
import {
  decryptStringFromStorage,
  encryptStringForStorage,
} from "@alixex/crypto"
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
const [vaultUnlockedSig, setVaultUnlockedSig] = signal(false)

export function isVaultUnlocked(): boolean {
  return vaultUnlockedSig()
}
export function lockVault(): void {
  masterPw = null
  jwkCache.clear()
  setVaultUnlockedSig(false)
}
export function activeJwk(): ArweaveJWK | null {
  const a = activeAccount()
  return a && a.type === "local" ? (jwkCache.get(a.id) ?? null) : null
}

/** Export a local account's keyfile as plain JWK JSON. Requires the account to be unlocked
 *  this session (its jwk is in the cache); returns null otherwise (e.g. locked, or not local). */
export function exportKeyfile(id: string): string | null {
  const jwk = jwkCache.get(id)
  return jwk ? JSON.stringify(jwk) : null
}

/** Export a local account's keyfile ENCRYPTED under `password` (safe to store). Returns null
 *  if the account's jwk isn't loaded (locked / not local). */
export async function exportEncrypted(
  id: string,
  password: string,
): Promise<string | null> {
  const jwk = jwkCache.get(id)
  if (!jwk) return null
  return JSON.stringify(await encryptStringForStorage(JSON.stringify(jwk), password))
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
        ? {
            ...a,
            address,
            label: a.label === PLACEHOLDER_LABEL ? shorten(address) : a.label,
          }
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
      const jwk = JSON.parse(
        await decryptStringFromStorage(JSON.parse(blob), pw),
      ) as ArweaveJWK
      jwkCache.set(id, jwk)
      await backfillAddress(id, jwk)
      ok++
    } catch {
      /* corrupt or wrong-pw entry — leave it locked */
    }
  }
  if (entries.length > 0 && ok === 0) throw new Error("Wrong password")
  masterPw = pw
  setVaultUnlockedSig(true)
}

// ── CRUD ─────────────────────────────────────────────────────────────────

/** Resolve the master password: use the session master, or establish it from `password` when the vault is empty. */
function resolveMaster(password?: string): string {
  if (masterPw !== null) return masterPw
  if (Object.keys(readVault()).length === 0 && password) {
    masterPw = password
    setVaultUnlockedSig(true)
    return password
  }
  throw new Error("VAULT_LOCKED") // caller must unlockVault() first
}

async function persistLocal(
  jwk: ArweaveJWK,
  pw: string,
): Promise<AccountRecord> {
  const address = await arweave.wallets.jwkToAddress(jwk)
  const id = newId()
  const blob = JSON.stringify(
    await encryptStringForStorage(JSON.stringify(jwk), pw),
  )
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
export async function importLocal(
  jwkJson: string,
  password?: string,
): Promise<AccountRecord> {
  let jwk: ArweaveJWK
  try {
    jwk = JSON.parse(jwkJson) as ArweaveJWK
  } catch {
    throw new Error("Invalid keyfile: not valid JSON")
  }
  if (!jwk || jwk.kty !== "RSA" || !jwk.n)
    throw new Error("Invalid keyfile: not an Arweave JWK")
  const pw = resolveMaster(password)
  return persistLocal(jwk, pw)
}

export async function connectWander(): Promise<AccountRecord> {
  const address = await connectArweave()
  const existing = accounts().find(
    (a) => a.type === "wander" && a.address === address,
  )
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
    (a) =>
      a.type === "evm" && a.address.toLowerCase() === address.toLowerCase(),
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
    const blob = readVault()[id]
    if (blob) {
      const jwk = JSON.parse(
        await decryptStringFromStorage(JSON.parse(blob), masterPw),
      ) as ArweaveJWK
      jwkCache.set(id, jwk)
      if (!rec.address) await backfillAddress(id, jwk)
    }
  }
  if (rec.type === "wander") await connectArweave() // throws if the extension is locked/unavailable → switch aborts
  persistActive(id)
}
