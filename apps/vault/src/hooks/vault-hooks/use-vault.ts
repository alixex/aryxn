import { useState, useCallback, useEffect } from "react"
import { useTranslation } from "@/i18n/config"
import { toast } from "sonner"
import {
  deriveKey,
  generateSalt,
  toBase64,
  fromBase64,
  decryptData,
  fromBytes,
} from "@aryxn/crypto"
import { db } from "@/lib/database"
import type { WalletRecord } from "@aryxn/wallet-core"

export const VAULT_SALT_LEGACY = new Uint8Array([
  0x61, 0x6e, 0x61, 0x6d, 0x6e, 0x65, 0x73, 0x69, 0x73, 0x2d, 0x76, 0x61, 0x75,
  0x6c, 0x74, 0x31,
])

export const STORAGE_KEY_SYSTEM_SALT = "vault_system_salt"

/**
 * Hook for managing the cryptographic vault (master key, vault ID, and salt)
 */
export function useVault() {
  const { t } = useTranslation()
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null)
  const [vaultId, setVaultId] = useState<string | null>(null)
  const [systemSalt, setSystemSalt] = useState<Uint8Array | null>(null)

  // Initialize or fetch system salt
  useEffect(() => {
    const initSalt = async () => {
      try {
        const saltRecord = await db.get(
          "SELECT value FROM vault_metadata WHERE key = ?",
          [STORAGE_KEY_SYSTEM_SALT],
        )

        if (saltRecord?.value) {
          setSystemSalt(fromBase64(String(saltRecord.value)))
        } else {
          // Check for existing wallets to maintain backward compatibility
          const walletCount = await db.get(
            "SELECT COUNT(*) as count FROM wallets",
          )
          if (walletCount && (walletCount as { count: number }).count > 0) {
            setSystemSalt(VAULT_SALT_LEGACY)
          } else {
            // Fresh install, generate new salt
            const newSalt = generateSalt()
            await db.run(
              "INSERT INTO vault_metadata (key, value) VALUES (?, ?)",
              [STORAGE_KEY_SYSTEM_SALT, toBase64(newSalt)],
            )
            setSystemSalt(newSalt)
          }
        }
      } catch (e) {
        console.error("Failed to initialize system salt:", e)
        setSystemSalt(VAULT_SALT_LEGACY) // Fallback
      }
    }
    initSalt()
  }, [])

  const getVaultId = async (key: Uint8Array) => {
    const keyBuffer = new Uint8Array(key).buffer
    const hashBuffer = await crypto.subtle.digest("SHA-256", keyBuffer)
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16)
  }

  const unlock = useCallback(
    async (password: string) => {
      try {
        const activeSalt = systemSalt || VAULT_SALT_LEGACY
        const key = await deriveKey(password, activeSalt)
        const vid = await getVaultId(key)
        setMasterKey(key)
        setVaultId(vid)
        toast.success(t("unlock.success"))
        return true
      } catch (error) {
        console.error("Unlock failed:", error)
        toast.error(t("unlock.failed"))
        return false
      }
    },
    [t, systemSalt],
  )

  const clearVault = useCallback(() => {
    setMasterKey(null)
    setVaultId(null)
  }, [])

  const getDecryptedInfo = useCallback(
    async (wallet: WalletRecord, passwordConfirm: string) => {
      try {
        const activeSalt = systemSalt || VAULT_SALT_LEGACY
        const key = await deriveKey(passwordConfirm, activeSalt)
        const vid = await getVaultId(key)

        if (vaultId && vid !== vaultId) {
          throw new Error("Incorrect password")
        }

        const { ciphertext, nonce } = JSON.parse(wallet.encryptedKey)
        const decrypted = await decryptData(
          fromBase64(ciphertext),
          fromBase64(nonce),
          key,
        )
        return JSON.parse(fromBytes(decrypted))
      } catch (e) {
        console.error("Decryption info error:", e)
        const errorMessage =
          e instanceof Error
            ? e.message
            : "Incorrect password or decryption failed"
        throw new Error(errorMessage)
      }
    },
    [vaultId, systemSalt],
  )

  return {
    masterKey,
    vaultId,
    systemSalt,
    unlock,
    clearVault,
    getDecryptedInfo,
    isUnlocked: !!masterKey,
  }
}
