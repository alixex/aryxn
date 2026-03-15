import { fromBase64, toBase64 } from "@aryxn/crypto"

const AUTH_VERSION = "v2"
const AUTH_STORAGE_KEY = "vault_resource_auth_capabilities_v2"
const AUTH_TTL_MS = 1000 * 60 * 15

type AuthCapabilityRecord = {
  txId: string
  keyB64: string
  expiresAt: number
}

type AuthCapabilityStore = Record<string, AuthCapabilityRecord>

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null
  }
  return window.sessionStorage
}

function readStore(): AuthCapabilityStore {
  const storage = getSessionStorage()
  if (!storage) {
    return {}
  }

  try {
    const raw = storage.getItem(AUTH_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as AuthCapabilityStore
    if (!parsed || typeof parsed !== "object") {
      return {}
    }

    return parsed
  } catch {
    return {}
  }
}

function writeStore(store: AuthCapabilityStore): void {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(store))
}

function cleanupExpiredCapabilities(
  store: AuthCapabilityStore,
): AuthCapabilityStore {
  const now = Date.now()
  const next: AuthCapabilityStore = {}
  for (const [tokenId, record] of Object.entries(store)) {
    if (
      record &&
      typeof record.expiresAt === "number" &&
      record.expiresAt > now
    ) {
      next[tokenId] = record
    }
  }
  return next
}

/**
 * Generates a short-lived one-time capability token.
 *
 * The URL only contains a random opaque token id. The actual key material is
 * stored in sessionStorage and is consumed once at decode time.
 */
export async function generateAuthParam(
  masterKey: Uint8Array,
  txId: string,
): Promise<string> {
  const storage = getSessionStorage()
  if (!storage) {
    throw new Error("Auth capability storage is unavailable")
  }

  const tokenId = crypto.randomUUID().replace(/-/g, "")
  const store = cleanupExpiredCapabilities(readStore())
  store[tokenId] = {
    txId,
    keyB64: toBase64(masterKey),
    expiresAt: Date.now() + AUTH_TTL_MS,
  }
  writeStore(store)

  return `${AUTH_VERSION}.${tokenId}`
}

/**
 * Resolves an auth capability token into a key.
 *
 * Tokens are one-time use and bound to txId.
 */
export async function decodeAuthParam(
  auth: string,
  txId: string,
): Promise<Uint8Array> {
  const [version, tokenId] = auth.split(".")
  if (version !== AUTH_VERSION || !tokenId) {
    throw new Error("Unsupported or malformed auth token")
  }

  const store = cleanupExpiredCapabilities(readStore())
  const record = store[tokenId]
  if (!record) {
    writeStore(store)
    throw new Error("Auth token expired or unavailable")
  }

  delete store[tokenId]
  writeStore(store)

  if (record.txId !== txId) {
    throw new Error("Auth token does not match this resource")
  }

  try {
    return fromBase64(record.keyB64)
  } catch {
    throw new Error("Auth token payload is invalid")
  }
}
