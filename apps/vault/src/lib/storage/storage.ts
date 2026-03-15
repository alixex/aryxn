import {
  uploadToArweave as genericUpload,
  estimateArweaveFee as genericEstimateFee,
  generateArweaveWallet,
  arweave,
  shouldCompressFile,
  getActualCompressedSize as genericGetCompressedSize,
  irysService,
} from "@alixex/arweave"
import type { ArweaveJWK } from "@alixex/wallet-core"
import { ARWEAVE_APP_NAME } from "@/lib/config"

export { arweave, generateArweaveWallet, shouldCompressFile, irysService }

/**
 * Domain-specific Arweave fee estimation.
 */
export const estimateArweaveFee = genericEstimateFee

/**
 * Domain-specific upload wrapper that adds Aryxn branding tags.
 */
export const uploadToArweave = async (
  file: File,
  key: ArweaveJWK | string | null,
  encryptionKey?: Uint8Array,
  useExternalWallet?: boolean,
  enableCompression?: boolean,
  ownerAddress?: string,
  onProgress?: (progress: { stage: string; progress: number }) => void,
  useIrys?: boolean,
  irysToken?: string,
  storageTier?: "Permanent" | "Term",
) => {
  const reader = new FileReader()
  return new Promise<{
    txId: string
    hash: string
    finalSize: number
    storageType: "arweave" | "irys"
    encryptionParams?: string
  }>((resolve, reject) => {
    reader.onload = async () => {
      try {
        const fileData = new Uint8Array(reader.result as ArrayBuffer)

        // Add Aryxn domain tags
        const tags = [{ name: "App-Name", value: ARWEAVE_APP_NAME }]

        if (useIrys) {
          // Add Irys network tag
          tags.push({ name: "Storage-Network", value: "Irys" })
          if (storageTier) {
            tags.push({ name: "Storage-Tier", value: storageTier })
          }

          const irys = await irysService.getIrysInstance({
            token: irysToken || "ethereum",
            wallet: key, // In browser, 'key' might be the provider or wallet
          })
          const txId = await irysService.upload(fileData, tags, irys)

          resolve({
            txId,
            hash: txId, // Irys ID as hash for now
            finalSize: fileData.length,
            storageType: "irys",
          })
          return
        }

        // Add Arweave network tag
        const arTags = {
          "App-Name": ARWEAVE_APP_NAME,
          "Storage-Network": "Arweave",
        }

        // Native Arweave fallback
        const result = await genericUpload(
          fileData,
          file.name,
          file.type,
          key,
          encryptionKey,
          useExternalWallet,
          enableCompression,
          ownerAddress,
          arTags,
          onProgress,
        )

        resolve({ ...result, storageType: "arweave" })
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Gets the actual compressed size for fee calculation.
 */
export async function getActualCompressedSize(file: File): Promise<number> {
  const fileBuffer = await file.arrayBuffer()
  const data = new Uint8Array(fileBuffer)
  return genericGetCompressedSize(data, file.name, file.type)
}
