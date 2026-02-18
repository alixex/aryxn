import type { StateStorage } from "zustand/middleware"
import {
  initSodium,
  encryptData,
  decryptData,
  toBase64,
  fromBase64,
} from "@aryxn/crypto"

const STORAGE_KEY_KEY = "aryxn_storage_key"

// Initialize encryption key lazily
let _encryptionKey: Uint8Array | null = null

async function getEncryptionKey(): Promise<Uint8Array> {
  if (_encryptionKey) return _encryptionKey

  const sodium = await initSodium()

  // Try to load existing key from localStorage (Not ideal for high security but standard for "local web wallet" caching)
  // For higher security, this key should be derived from user signature or password.
  // Here we generate a random key that stays on this device, making the data unreadable if exported without this key.

  const existingKeyHex = localStorage.getItem(STORAGE_KEY_KEY)

  if (existingKeyHex) {
    _encryptionKey = sodium.from_hex(existingKeyHex)
  } else {
    _encryptionKey = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES)
    localStorage.setItem(STORAGE_KEY_KEY, sodium.to_hex(_encryptionKey))
  }

  return _encryptionKey
}

export const createEncryptedStorage = (): StateStorage => {
  return {
    getItem: async (name: string): Promise<string | null> => {
      const item = localStorage.getItem(name)
      if (!item) return null

      try {
        // Format: version:nonce:ciphertext
        const parts = item.split(":")
        if (parts.length !== 3 || parts[0] !== "v1") {
          // Fallback to cleartext if format doesn't match (migration)
          return item
        }

        const nonce = fromBase64(parts[1])
        const ciphertext = fromBase64(parts[2])
        const key = await getEncryptionKey()

        const decrypted = await decryptData(ciphertext, nonce, key)
        return new TextDecoder().decode(decrypted)
      } catch (e) {
        console.error("Failed to decrypt storage item:", name, e)
        return null
      }
    },
    setItem: async (name: string, value: string): Promise<void> => {
      try {
        const key = await getEncryptionKey()
        const data = new TextEncoder().encode(value)
        const { ciphertext, nonce } = await encryptData(data, key)

        // Store as v1:nonce_base64:ciphertext_base64
        const storageValue = `v1:${toBase64(nonce)}:${toBase64(ciphertext)}`
        localStorage.setItem(name, storageValue)
      } catch (e) {
        console.error("Failed to encrypt storage item:", name, e)
      }
    },
    removeItem: (name: string): void => {
      localStorage.removeItem(name)
    },
  }
}
