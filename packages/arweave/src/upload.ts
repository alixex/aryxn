import { type ArweaveJWK } from "@aryxn/wallet-core"
import { encryptData, toBase64 } from "@aryxn/crypto"
import { compressData } from "./compression"
import { arweave } from "./wallet"
import { t } from "./i18n"

/**
 * 上传数据到 Arweave
 */
export const uploadToArweave = async (
  fileData: Uint8Array,
  fileName: string,
  fileMimeType: string,
  key: ArweaveJWK | string | null,
  encryptionKey?: Uint8Array,
  useExternalWallet?: boolean,
  enableCompression?: boolean,
  ownerAddress?: string,
  tags?: Record<string, string>,
  onProgress?: (progress: { stage: string; progress: number }) => void,
): Promise<{
  txId: string
  hash: string
  finalSize: number
  encryptionParams?: string
}> => {
  try {
    onProgress?.({ stage: t("upload.preparing"), progress: 10 })

    let data = fileData
    let encryptionInfo = null
    let compressionInfo = null

    if (enableCompression) {
      onProgress?.({ stage: t("upload.compressing"), progress: 30 })
      try {
        const originalSize = data.length
        const compressed = await compressData(data)

        if (compressed.length < originalSize) {
          data = compressed
          compressionInfo = { algo: "gzip", enabled: true }
        } else {
          compressionInfo = { algo: "gzip", enabled: true }
        }
      } catch (compressionError) {
        console.warn(t("upload.compression_failed"), compressionError)
      }
    }

    if (encryptionKey) {
      onProgress?.({ stage: t("upload.encrypting"), progress: 50 })
      const { ciphertext, nonce } = await encryptData(data, encryptionKey)
      data = ciphertext
      encryptionInfo = {
        algo: "XChaCha20-Poly1305",
        params: JSON.stringify({ nonce: toBase64(nonce) }),
      }
    }

    onProgress?.({ stage: t("upload.create_tx"), progress: 60 })

    let transactionKey: ArweaveJWK | string | "use_wallet" = key || "use_wallet"

    if (useExternalWallet && (globalThis as any).arweaveWallet) {
      await (globalThis as any).arweaveWallet.getActiveAddress()
      const tempKey = await arweave.wallets.generate()
      transactionKey = tempKey as unknown as ArweaveJWK
    } else if (!key) {
      throw new Error(t("upload.key_required"))
    }

    const transaction = await arweave.createTransaction(
      { data },
      typeof transactionKey === "string" && transactionKey !== "use_wallet"
        ? (JSON.parse(transactionKey) as ArweaveJWK)
        : transactionKey,
    )

    transaction.addTag(
      "Content-Type",
      encryptionKey ? "application/octet-stream" : fileMimeType,
    )
    transaction.addTag("File-Name", fileName)

    if (ownerAddress) {
      transaction.addTag("Owner-Address", ownerAddress)
    }

    // Apply custom tags
    if (tags) {
      for (const [name, value] of Object.entries(tags)) {
        transaction.addTag(name, value)
      }
    }

    if (encryptionInfo) {
      transaction.addTag("Encryption-Algo", encryptionInfo.algo)
      transaction.addTag("Encryption-Params", encryptionInfo.params)
    }
    if (compressionInfo) {
      transaction.addTag("Compression-Algo", compressionInfo.algo)
      transaction.addTag("Compression-Enabled", "true")
    }

    onProgress?.({ stage: t("upload.signing"), progress: 70 })

    if (useExternalWallet && (globalThis as any).arweaveWallet) {
      await (globalThis as any).arweaveWallet.sign(transaction)
    } else {
      if (!key) throw new Error(t("upload.key_required_short"))
      const signKey =
        typeof key === "string" ? (JSON.parse(key) as ArweaveJWK) : key
      await arweave.transactions.sign(transaction, signKey)
    }

    // SHA-256 hash
    const dataBuffer = new ArrayBuffer(data.length)
    const dataArray = new Uint8Array(dataBuffer)
    dataArray.set(data)
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")

    onProgress?.({ stage: t("upload.uploading"), progress: 80 })

    let uploader = await arweave.transactions.getUploader(transaction)

    while (!uploader.isComplete) {
      try {
        await uploader.uploadChunk()
        const uploadStageProgress = 80 + uploader.pctComplete * 0.2
        onProgress?.({
          stage: t("upload.uploading"),
          progress: Math.min(99, uploadStageProgress),
        })
      } catch (e) {
        console.error(t("upload.chunk_failed"), e)
        await new Promise((r) => setTimeout(r, 3000))
      }
    }

    onProgress?.({ stage: t("upload.complete"), progress: 100 })

    return {
      txId: transaction.id,
      hash,
      finalSize: data.length,
      encryptionParams: encryptionInfo?.params,
    }
  } catch (error) {
    console.error("Arweave upload error:", error)
    throw error
  }
}
