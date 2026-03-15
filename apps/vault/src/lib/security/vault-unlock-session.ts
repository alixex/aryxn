import { fromBase64, toBase64 } from "@alixex/crypto"

const UNLOCK_SESSION_STORAGE_KEY = "vault_unlock_session_v1"
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7

type VaultUnlockSession = {
  vaultId: string
  masterKeyB64: string
  unlockedAt: number
  expiresAt: number
}

function readUnlockSessionRaw(): VaultUnlockSession | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = window.localStorage.getItem(UNLOCK_SESSION_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as VaultUnlockSession
    if (
      !parsed ||
      typeof parsed.vaultId !== "string" ||
      typeof parsed.masterKeyB64 !== "string" ||
      typeof parsed.unlockedAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function saveVaultUnlockSession(
  masterKey: Uint8Array,
  vaultId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  if (typeof window === "undefined") {
    return
  }

  const now = Date.now()
  const payload: VaultUnlockSession = {
    vaultId,
    masterKeyB64: toBase64(masterKey),
    unlockedAt: now,
    expiresAt: now + ttlMs,
  }

  window.localStorage.setItem(
    UNLOCK_SESSION_STORAGE_KEY,
    JSON.stringify(payload),
  )
}

export function loadVaultUnlockSession(): {
  masterKey: Uint8Array
  vaultId: string
} | null {
  const payload = readUnlockSessionRaw()
  if (!payload) {
    return null
  }

  if (payload.expiresAt <= Date.now()) {
    clearVaultUnlockSession()
    return null
  }

  try {
    return {
      masterKey: fromBase64(payload.masterKeyB64),
      vaultId: payload.vaultId,
    }
  } catch {
    clearVaultUnlockSession()
    return null
  }
}

export function clearVaultUnlockSession(): void {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.removeItem(UNLOCK_SESSION_STORAGE_KEY)
}
