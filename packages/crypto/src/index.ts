import sodium from "libsodium-wrappers"

type Sodium = typeof sodium

let _s: Sodium | null = null

export const initSodium = async (): Promise<Sodium> => {
  if (_s) return _s
  await sodium.ready
  _s = (sodium as { default?: Sodium }).default || sodium
  return _s
}

/**
 * Generate a cryptographically strong random salt
 */
export const generateSalt = (length = 16): Uint8Array => {
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * 使用 PBKDF2 派生密钥
 */
export const deriveKey = async (password: string, salt: Uint8Array) => {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  )

  // 确保 salt.buffer 是 ArrayBuffer 类型（不是 SharedArrayBuffer）
  const saltArray = new Uint8Array(salt.buffer)
  const saltBuffer = new ArrayBuffer(saltArray.length)
  new Uint8Array(saltBuffer).set(saltArray)

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  )

  // 关键修复：强制创建一个全新的 Uint8Array 副本
  const cleanKey = new Uint8Array(32)
  cleanKey.set(new Uint8Array(derivedBits))
  return cleanKey
}

// Encrypt data with a key
export const encryptData = async (data: Uint8Array, key: Uint8Array) => {
  const s = await initSodium()
  try {
    const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES)
    const ciphertext = s.crypto_secretbox_easy(data, nonce, key)
    return { ciphertext, nonce }
  } catch (e) {
    console.error("Encryption failed:", e)
    throw e
  }
}

// Decrypt data with a key
export const decryptData = async (
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array,
) => {
  const s = await initSodium()
  try {
    // 检查参数
    if (ciphertext.length < 16) {
      throw new Error(
        `ciphertext is too short: ${ciphertext.length} bytes (minimum 16 bytes for Poly1305 tag)`,
      )
    }
    if (nonce.length !== s.crypto_secretbox_NONCEBYTES) {
      throw new Error(
        `Invalid nonce length: expected ${s.crypto_secretbox_NONCEBYTES}, got ${nonce.length}`,
      )
    }
    if (key.length !== s.crypto_secretbox_KEYBYTES) {
      throw new Error(
        `Invalid key length: expected ${s.crypto_secretbox_KEYBYTES}, got ${key.length}`,
      )
    }

    const result = s.crypto_secretbox_open_easy(ciphertext, nonce, key)
    if (!result) throw new Error("Decryption returned null (wrong key/nonce)")
    return result
  } catch (e) {
    console.error("Decryption failed:", e)
    if (e instanceof Error && e.message.includes("too short")) {
      throw e
    }
    throw new Error("Decryption failed. Wrong password or corrupted data?")
  }
}

// Helper: Uint8Array to Hex
export const toHex = (bytes: Uint8Array) => {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

// Helper to convert string to Uint8Array
export const toBytes = (str: string) => new TextEncoder().encode(str)
// Helper to convert Uint8Array to string
export const fromBytes = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

// Helper for Base64 conversion
export const toBase64 = (bytes: Uint8Array) => {
  return btoa(String.fromCharCode(...bytes))
}

export const fromBase64 = (base64: string) => {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

export * from "./keys"
export * from "./mnemonic"
