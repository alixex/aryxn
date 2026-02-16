import {
  uploadToArweave as genericUpload,
  estimateArweaveFee as genericEstimateFee,
  generateArweaveWallet,
  arweave,
  shouldCompressFile,
  getActualCompressedSize as genericGetCompressedSize,
} from "@aryxn/arweave"
import type { ArweaveJWK } from "@aryxn/wallet-core"

export { arweave, generateArweaveWallet, shouldCompressFile }

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
) => {
  const reader = new FileReader()
  return new Promise<{
    txId: string
    hash: string
    finalSize: number
    encryptionParams?: string
  }>((resolve, reject) => {
    reader.onload = async () => {
      try {
        const fileData = new Uint8Array(reader.result as ArrayBuffer)

        // Add Aryxn domain tags
        const tags = {
          "App-Name": "Aryxn",
          // Any other domain-specific tags here
        }

        const result = await genericUpload(
          fileData,
          file.name,
          file.type,
          key,
          encryptionKey,
          useExternalWallet,
          enableCompression,
          ownerAddress,
          tags,
          onProgress,
        )

        resolve(result)
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
