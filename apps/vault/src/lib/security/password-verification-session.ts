import { toBase64 } from "@aryxn/crypto"

const SESSION_STORAGE_KEY = "vault_password_verification_session_v1"
const SESSION_PROOF_MARKER = "vault-password-verification-proof-v1"
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7

type PasswordVerificationSession = {
  vaultId: string
  proof: string
  verifiedAt: number
  expiresAt: number
}

function readSessionPayload(): PasswordVerificationSession | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as PasswordVerificationSession
    if (
      !parsed ||
      typeof parsed.vaultId !== "string" ||
      typeof parsed.proof !== "string" ||
      typeof parsed.verifiedAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

async function createProof(
  masterKey: Uint8Array,
  vaultId: string,
): Promise<string> {
  const encoded = new TextEncoder().encode(
    `${toBase64(masterKey)}:${vaultId}:${SESSION_PROOF_MARKER}`,
  )
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded)
  return toBase64(new Uint8Array(hashBuffer))
}

export async function markPasswordVerificationSession(
  masterKey: Uint8Array,
  vaultId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<void> {
  if (typeof window === "undefined") {
    return
  }

  const now = Date.now()
  const payload: PasswordVerificationSession = {
    vaultId,
    proof: await createProof(masterKey, vaultId),
    verifiedAt: now,
    expiresAt: now + ttlMs,
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload))
}

export async function hasValidPasswordVerificationSession(
  masterKey: Uint8Array,
  vaultId: string,
): Promise<boolean> {
  if (typeof window === "undefined") {
    return false
  }

  const payload = readSessionPayload()
  if (!payload) {
    return false
  }

  if (payload.expiresAt <= Date.now() || payload.vaultId !== vaultId) {
    clearPasswordVerificationSession()
    return false
  }

  const expectedProof = await createProof(masterKey, vaultId)
  const isValid = expectedProof === payload.proof

  if (!isValid) {
    clearPasswordVerificationSession()
  }

  return isValid
}

export function clearPasswordVerificationSession(): void {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
}
