/*
 * Persistence helpers for encrypted cache storage in the browser.
 * - Provides `persistEncrypted` and `loadEncrypted` that use WebCrypto
 * - Stores encrypted data to localStorage using AES-GCM encryption
 * - Key derivation via PBKDF2
 */

import {
  encryptStringForStorage,
  decryptStringFromStorage,
} from "@aryxn/crypto"

export async function persistEncrypted(key: string, obj: any): Promise<void> {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("localStorage is not available")
  }
  const raw = JSON.stringify(obj)
  const encrypted = await encryptStringForStorage(raw, key)
  window.localStorage.setItem(key, JSON.stringify(encrypted))
}

export async function loadEncrypted(key: string): Promise<any | null> {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("localStorage is not available")
  }
  const encrypted = window.localStorage.getItem(key)
  if (!encrypted) return null
  try {
    const raw = await decryptStringFromStorage(JSON.parse(encrypted), key)
    return JSON.parse(raw)
  } catch (e) {
    console.error("Failed to decrypt data from storage:", e)
    return null
  }
}
