import { useCallback } from "react"
import { db } from "@/lib/database"
import { encryptData, toBytes, toBase64 } from "@aryxn/crypto"
import {
  type WalletRecord,
  type WalletKey,
  createWallet,
  detectChainAndAddress,
  type DecryptedData,
} from "@aryxn/wallet-core"
import { toast } from "sonner"
import { useTranslation } from "@/i18n/config"
import { arweave } from "@/lib/storage"

export function useWalletOps() {
  const { t } = useTranslation()

  const createWalletLogic = useCallback(
    async (
      chain: WalletRecord["chain"],
      alias: string,
      masterKey: Uint8Array,
      vaultId: string,
    ) => {
      try {
        const { key, address, mnemonic } = await createWallet(chain, arweave)

        const storageData: DecryptedData = { key, mnemonic }
        const { ciphertext, nonce } = await encryptData(
          toBytes(JSON.stringify(storageData)),
          masterKey,
        )
        await db.run(
          `INSERT INTO wallets (address, encrypted_key, alias, chain, vault_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            address,
            JSON.stringify({
              ciphertext: toBase64(ciphertext),
              nonce: toBase64(nonce),
            }),
            alias,
            chain,
            vaultId,
            Date.now(),
          ],
        )
        toast.success(t("identities.successAdded", { alias }))
        return { address, alias }
      } catch (e) {
        console.error("Wallet creation error:", e)
        const errorMessage =
          e instanceof Error ? e.message : "Failed to create wallet"
        toast.error(errorMessage)
        throw e
      }
    },
    [t],
  )

  const addWalletLogic = useCallback(
    async (
      input: WalletKey | string,
      alias: string,
      masterKey: Uint8Array,
      vaultId: string,
    ) => {
      try {
        const { chain, address, key, mnemonic } = await detectChainAndAddress(
          input,
          arweave,
        )
        const storageData: DecryptedData = { key, mnemonic }
        const { ciphertext, nonce } = await encryptData(
          toBytes(JSON.stringify(storageData)),
          masterKey,
        )
        await db.run(
          `INSERT INTO wallets (address, encrypted_key, alias, chain, vault_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            address,
            JSON.stringify({
              ciphertext: toBase64(ciphertext),
              nonce: toBase64(nonce),
            }),
            alias,
            chain,
            vaultId,
            Date.now(),
          ],
        )
        toast.success(t("identities.successAdded", { alias }))
        return { address, alias }
      } catch (e) {
        const errorMessage =
          e instanceof Error ? e.message : "Failed to add wallet"
        toast.error(errorMessage)
        throw e
      }
    },
    [t],
  )

  return {
    detectChainAndAddress: (input: WalletKey | string) =>
      detectChainAndAddress(input, arweave),
    createWalletLogic,
    addWalletLogic,
  }
}
