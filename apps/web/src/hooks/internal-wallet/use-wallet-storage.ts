import { useState, useCallback, useEffect } from "react"
import { db } from "@/lib/sqlite-db"
import { type DbRow } from "@aryxn/storage"
import type { WalletRecord, WalletKey } from "@aryxn/wallet-core"
import { decryptData, fromBase64, fromBytes } from "@aryxn/crypto"

export const STORAGE_KEY_ACTIVE_ADDRESS = "active_address"
export const STORAGE_KEY_USE_EXTERNAL = "use_external"

export function useWalletStorage(
  vaultId: string | null,
  masterKey: Uint8Array | null,
) {
  const [wallets, setWallets] = useState<WalletRecord[]>([])
  const [activeAddress, setActiveAddress] = useState<string | null>(null)
  const [activeWallet, setActiveWallet] = useState<WalletKey | null>(null)
  const [useExternal, setUseExternal] = useState<boolean>(false)
  const [hasSavedLocalAccount, setHasSavedLocalAccount] =
    useState<boolean>(false)

  const loadWallets = useCallback(async () => {
    if (!vaultId) {
      setWallets([])
      return
    }
    const rows = await db.all(
      "SELECT * FROM wallets WHERE vault_id = ? ORDER BY created_at DESC",
      [vaultId],
    )
    const filteredWallets: WalletRecord[] = rows.map((row: DbRow) => ({
      id: typeof row.id === "number" ? row.id : undefined,
      address: String(row.address),
      encryptedKey: String(row.encrypted_key),
      alias: String(row.alias),
      chain: row.chain as WalletRecord["chain"],
      vaultId: String(row.vault_id),
      createdAt:
        typeof row.created_at === "number"
          ? row.created_at
          : Number(row.created_at),
    }))
    setWallets(filteredWallets)
  }, [vaultId])

  useEffect(() => {
    loadWallets()
  }, [loadWallets])

  // Load account state (active address and external flag)
  useEffect(() => {
    if (vaultId) {
      const loadAccountState = async () => {
        try {
          const activeAddressRecord = await db.get(
            "SELECT value FROM vault_metadata WHERE key = ?",
            [`${STORAGE_KEY_ACTIVE_ADDRESS}_${vaultId}`],
          )
          const useExternalRecord = await db.get(
            "SELECT value FROM vault_metadata WHERE key = ?",
            [`${STORAGE_KEY_USE_EXTERNAL}_${vaultId}`],
          )

          const savedAddress = activeAddressRecord?.value
          const savedUseExternal = useExternalRecord?.value === "true"

          if (savedUseExternal) {
            setActiveAddress(null)
            setActiveWallet(null)
            setUseExternal(true)
            setHasSavedLocalAccount(false)
          } else if (savedAddress && typeof savedAddress === "string") {
            setUseExternal(false)
            setHasSavedLocalAccount(true)
          } else {
            setHasSavedLocalAccount(false)
          }
        } catch (e) {
          console.error("Failed to load account state:", e)
        }
      }
      loadAccountState()
    } else {
      setHasSavedLocalAccount(false)
    }
  }, [vaultId])

  // Restore active wallet when wallets and masterKey are available
  useEffect(() => {
    if (vaultId && wallets.length > 0 && !useExternal && masterKey) {
      const restoreWallet = async () => {
        try {
          const activeAddressRecord = await db.get(
            "SELECT value FROM vault_metadata WHERE key = ?",
            [`${STORAGE_KEY_ACTIVE_ADDRESS}_${vaultId}`],
          )
          const savedAddress = activeAddressRecord?.value

          if (savedAddress && typeof savedAddress === "string") {
            const wallet = wallets.find((w) => w.address === savedAddress)
            if (wallet) {
              const { ciphertext, nonce } = JSON.parse(wallet.encryptedKey)
              const decrypted = await decryptData(
                fromBase64(ciphertext),
                fromBase64(nonce),
                masterKey,
              )
              const data = JSON.parse(fromBytes(decrypted))

              setActiveAddress(savedAddress)
              setActiveWallet(
                wallet.chain === "arweave" ? JSON.parse(data.key) : data.key,
              )
            }
          }
        } catch (e) {
          console.error("Failed to restore wallet:", e)
        }
      }
      restoreWallet()
    }
  }, [vaultId, wallets, masterKey, useExternal])

  const saveActiveAccount = useCallback(
    async (address: string | null, isExternal: boolean) => {
      if (!vaultId) return

      if (isExternal) {
        setActiveAddress(null)
        setActiveWallet(null)
        setUseExternal(true)
        setHasSavedLocalAccount(false)

        await db.run("DELETE FROM vault_metadata WHERE key = ?", [
          `${STORAGE_KEY_ACTIVE_ADDRESS}_${vaultId}`,
        ])
        await db.run(
          `INSERT OR REPLACE INTO vault_metadata (key, value) VALUES (?, ?)`,
          [`${STORAGE_KEY_USE_EXTERNAL}_${vaultId}`, "true"],
        )
      } else if (address) {
        const wallet = wallets.find((w) => w.address === address)
        if (wallet && masterKey) {
          try {
            const { ciphertext, nonce } = JSON.parse(wallet.encryptedKey)
            const decrypted = await decryptData(
              fromBase64(ciphertext),
              fromBase64(nonce),
              masterKey,
            )
            const data = JSON.parse(fromBytes(decrypted))

            setActiveAddress(address)
            setActiveWallet(
              wallet.chain === "arweave" ? JSON.parse(data.key) : data.key,
            )
            setUseExternal(false)
            setHasSavedLocalAccount(true)

            await db.run(
              `INSERT OR REPLACE INTO vault_metadata (key, value) VALUES (?, ?)`,
              [`${STORAGE_KEY_ACTIVE_ADDRESS}_${vaultId}`, address],
            )
            await db.run(
              `INSERT OR REPLACE INTO vault_metadata (key, value) VALUES (?, ?)`,
              [`${STORAGE_KEY_USE_EXTERNAL}_${vaultId}`, "false"],
            )
          } catch (e) {
            console.error("Failed to activate wallet:", e)
          }
        }
      }
    },
    [vaultId, wallets, masterKey],
  )

  const clearPersistence = useCallback(async () => {
    if (vaultId) {
      await db.run("DELETE FROM vault_metadata WHERE key = ?", [
        `${STORAGE_KEY_ACTIVE_ADDRESS}_${vaultId}`,
      ])
      await db.run("DELETE FROM vault_metadata WHERE key = ?", [
        `${STORAGE_KEY_USE_EXTERNAL}_${vaultId}`,
      ])
    }
    setWallets([])
    setActiveAddress(null)
    setActiveWallet(null)
    setUseExternal(false)
    setHasSavedLocalAccount(false)
  }, [vaultId])

  return {
    wallets,
    activeAddress,
    activeWallet,
    useExternal,
    hasSavedLocalAccount,
    loadWallets,
    saveActiveAccount,
    clearPersistence,
    setWallets,
    setActiveAddress,
    setActiveWallet,
    setUseExternal,
    setHasSavedLocalAccount,
  }
}
