// Account management. Two kinds of account:
//   - external: an injected Arweave wallet (Wander / ArConnect) signs uploads.
//   - local:    an Arweave keyfile (JWK) held by this app, stored ENCRYPTED
//               (password) in localStorage and decrypted into memory per session.
// Local accounts restore backward compatibility for users of the original vault
// (import their old keyfile → see history + keep uploading) and work without any
// browser extension. No transfer / multi-chain — this is a storage account only.

import { arweave, generateArweaveWallet, type ArweaveJWK } from "@alixex/arweave"
import { encryptStringForStorage, decryptStringFromStorage } from "@alixex/crypto"
import {
  connectArweave as connectWander,
  disconnectArweave as disconnectWander,
} from "./wallet"

const STORE_KEY = "aryxn:account"

export type Account =
  | { kind: "external"; address: string }
  | { kind: "local"; address: string }
  | null

// The decrypted JWK for the active local account — in memory only, never persisted
// unencrypted. Cleared on disconnect.
let localJwk: ArweaveJWK | null = null

/** True if an encrypted local account is stored (so we can offer "Unlock"). */
export function hasStoredAccount(): boolean {
  try {
    return !!localStorage.getItem(STORE_KEY)
  } catch {
    return false
  }
}

async function persist(jwk: ArweaveJWK, password: string): Promise<string> {
  const address = await arweave.wallets.jwkToAddress(jwk)
  const enc = await encryptStringForStorage(JSON.stringify(jwk), password)
  localStorage.setItem(STORE_KEY, JSON.stringify(enc))
  localJwk = jwk
  return address
}

/** Generate a brand-new local Arweave account, encrypted with `password`. */
export async function createLocal(password: string): Promise<Account> {
  const { key } = await generateArweaveWallet()
  const address = await persist(key as ArweaveJWK, password)
  return { kind: "local", address }
}

/** Import an existing Arweave keyfile (JWK JSON), encrypted with `password`. */
export async function importKeyfile(jwkJson: string, password: string): Promise<Account> {
  let jwk: ArweaveJWK
  try {
    jwk = JSON.parse(jwkJson) as ArweaveJWK
  } catch {
    throw new Error("Invalid keyfile: not valid JSON")
  }
  if (!jwk || jwk.kty !== "RSA" || !jwk.n) {
    throw new Error("Invalid keyfile: not an Arweave JWK")
  }
  const address = await persist(jwk, password)
  return { kind: "local", address }
}

/** Decrypt the stored local account with `password`. */
export async function unlock(password: string): Promise<Account> {
  const raw = localStorage.getItem(STORE_KEY)
  if (!raw) throw new Error("No stored account")
  const jwkJson = await decryptStringFromStorage(JSON.parse(raw), password)
  const jwk = JSON.parse(jwkJson) as ArweaveJWK
  localJwk = jwk
  const address = await arweave.wallets.jwkToAddress(jwk)
  return { kind: "local", address }
}

/** Connect an injected Arweave wallet (Wander / ArConnect). */
export async function connectExternal(): Promise<Account> {
  const address = await connectWander()
  localJwk = null
  return { kind: "external", address }
}

export async function disconnect(): Promise<void> {
  localJwk = null
  try {
    await disconnectWander()
  } catch {
    /* external may not be connected */
  }
}

/** Forget the stored local account entirely (irreversible without a backup). */
export function forgetLocal(): void {
  localStorage.removeItem(STORE_KEY)
  localJwk = null
}

/** Export the active local keyfile as plain JWK JSON (for backup / migration). */
export function exportKeyfile(): string | null {
  return localJwk ? JSON.stringify(localJwk) : null
}

/** Export the active local keyfile encrypted with `password` (safe to store). */
export async function exportEncrypted(password: string): Promise<string | null> {
  if (!localJwk) return null
  const enc = await encryptStringForStorage(JSON.stringify(localJwk), password)
  return JSON.stringify(enc)
}

/** The JWK to sign uploads with — null means "use the external wallet". */
export function activeJwk(): ArweaveJWK | null {
  return localJwk
}
