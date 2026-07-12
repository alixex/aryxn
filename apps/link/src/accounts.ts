// Account book store: types, storage keys, and reactive state.
// Replaces the single-account `account.ts` (see Task 4/5 of the multi-account
// plan for migration, CRUD, and vault unlock/lock logic built on top of this).

import { signal, computed } from "ranui/builder"
import type { ArweaveJWK } from "@alixex/arweave"

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

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

// ── Reactive state ─────────────────────────────────────────────────────────
// Setters are added in Task 4/5 (persistAccounts/persistActive) once there's
// CRUD/migration logic that needs to write through them.
const [accounts] = signal<AccountRecord[]>(readJSON(ACCOUNTS_KEY, []))
const [activeId] = signal<string | null>(localStorage.getItem(ACTIVE_KEY))
export { accounts, activeId }
export const activeAccount = computed<AccountRecord | null>(
  () => accounts().find((a) => a.id === activeId()) ?? null,
)

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
