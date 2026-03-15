/**
 * Resource auth parameter utilities.
 *
 * Encodes the file encryption key into a URL-safe token bound to the txId.
 * Security model:
 *   - The token is AES-GCM encrypted using a key derived from the txId, so
 *     the raw masterKey is never plaintext in the URL.
 *   - A fresh random IV is used each time, so the same key generates different
 *     tokens across share operations.
 *   - The token is tied to the specific txId: decoding requires knowing the
 *     txId (which is in the URL alongside the token, providing context binding).
 *   - This prevents casual URL inspection, log scraping, and trivial reverse
 *     engineering while keeping the scheme fully client-side with no server.
 */

const AUTH_VERSION = 1

/**
 * Derives a binding CryptoKey from the txId using SHA-256.
 * This is deterministic given txId, which ties the auth token to this file.
 */
async function getBindingKey(txId: string): Promise<CryptoKey> {
  const data = new TextEncoder().encode(`aryxn:share:v1:${txId}`)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ])
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function fromBase64Url(token: string): Uint8Array {
  const pad =
    token.length % 4 === 0 ? token : token + "====".slice(token.length % 4)
  const b64 = pad.replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

/**
 * Encodes the masterKey into a URL-safe auth token bound to the given txId.
 */
export async function generateAuthParam(
  masterKey: Uint8Array,
  txId: string,
): Promise<string> {
  const bindingKey = await getBindingKey(txId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    bindingKey,
    new Uint8Array(masterKey),
  )

  const combined = new Uint8Array(1 + iv.length + ciphertext.byteLength)
  combined[0] = AUTH_VERSION
  combined.set(iv, 1)
  combined.set(new Uint8Array(ciphertext), 1 + iv.length)

  return toBase64Url(combined)
}

/**
 * Decodes an auth token back to the masterKey.
 * Throws if the token is malformed, uses an unsupported version, or the
 * AES-GCM tag check fails (tampered/wrong txId).
 */
export async function decodeAuthParam(
  auth: string,
  txId: string,
): Promise<Uint8Array> {
  let combined: Uint8Array
  try {
    combined = fromBase64Url(auth)
  } catch {
    throw new Error("Invalid auth token format")
  }

  if (combined.length < 1 + 12 + 16) {
    throw new Error("Auth token too short")
  }

  const version = combined[0]
  if (version !== AUTH_VERSION) {
    throw new Error(`Unsupported auth version: ${version}`)
  }

  const iv = combined.slice(1, 13)
  const ciphertext = combined.slice(13)

  const bindingKey = await getBindingKey(txId)
  let keyBuffer: ArrayBuffer
  try {
    keyBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      bindingKey,
      ciphertext,
    )
  } catch {
    throw new Error(
      "Auth token decryption failed — token may be invalid or tampered",
    )
  }

  return new Uint8Array(keyBuffer)
}
