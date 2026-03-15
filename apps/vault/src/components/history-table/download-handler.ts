import type { UploadRecord } from "@/lib/utils"
import { toast } from "sonner"
import type { TFunction } from "i18next"
import {
  getTransactionMetadata,
  downloadTransactionData,
  downloadTransactionFile,
} from "./download-data"
import {
  decodeTransactionTags,
  extractCompressionInfo,
  extractEncryptionParams,
} from "./transaction-tags"
import {
  processFileData,
  createEncryptedFilePackage,
  ensureStandardUint8Array,
} from "./process-data"

/**
 * Main handler for file downloads.
 */
export async function handleFileDownload(
  record: UploadRecord,
  masterKey: Uint8Array | null,
  decrypt: boolean,
  t: TFunction<"translation", undefined>,
  options?: {
    onProgress?: (loaded: number, total: number | null) => void
    signal?: AbortSignal
  },
): Promise<void> {
  // Fetch transaction metadata.
  const { transaction, expectedDataSize } = await getTransactionMetadata(
    record.txId,
  )

  // Decode transaction tags.
  const decodedTags = decodeTransactionTags(transaction?.tags)

  if (decodedTags.length > 0) {
    console.log(
      "Transaction tags (decoded):",
      decodedTags.map((t) => ({ name: t.name, value: t.value })),
    )
  } else {
    console.warn(
      "Transaction or tags not available, using database values only",
    )
  }

  const { compressionEnabled, compressionAlgo } =
    extractCompressionInfo(decodedTags)
  const { encryptionParamsTag } = extractEncryptionParams(decodedTags)

  console.log("Compression tags:", {
    compressionEnabled,
    compressionAlgo,
  })

  console.log("Encryption params:", {
    hasTag: !!encryptionParamsTag,
    tagValue: encryptionParamsTag?.value,
    dbValue: record.encryptionParams,
    encryptionAlgo: record.encryptionAlgo,
  })

  // For unencrypted and non-compressed files, download from cached File path directly.
  if (decrypt && record.encryptionAlgo === "none" && !compressionEnabled) {
    const file = await downloadTransactionFile(
      record.txId,
      expectedDataSize,
      record.storageType,
      {
        ownerAddress: record.ownerAddress,
        isEncrypted: false,
        mimeType: record.mimeType,
        fileName: record.fileName,
        onProgress: options?.onProgress,
        signal: options?.signal,
      },
    )

    const url = URL.createObjectURL(file)
    const a = document.createElement("a")
    a.href = url
    a.download = record.fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(t("history.successDownload"))
    return
  }

  // Download transaction data.
  const data = await downloadTransactionData(
    record.txId,
    expectedDataSize,
    record.storageType,
    {
      ownerAddress: record.ownerAddress,
      isEncrypted: record.encryptionAlgo !== "none",
      mimeType: record.mimeType,
      onProgress: options?.onProgress,
      signal: options?.signal,
    },
  )

  // When downloading encrypted content without decrypting, package it as JSON.
  if (record.encryptionAlgo !== "none" && !decrypt) {
    console.log("Downloading encrypted file (not decrypting):", {
      fileName: record.fileName,
      encryptionAlgo: record.encryptionAlgo,
      dataLength: data.length,
    })

    const processedData = ensureStandardUint8Array(data)
    const jsonString = createEncryptedFilePackage(
      processedData,
      record,
      encryptionParamsTag,
      compressionEnabled,
      compressionAlgo,
    )

    const jsonBlob = new Blob([jsonString], {
      type: "application/json;charset=utf-8",
    })

    const url = URL.createObjectURL(jsonBlob)
    const a = document.createElement("a")
    a.href = url
    const downloadFileName = record.fileName.endsWith(".json")
      ? record.fileName.replace(".json", ".encrypted.json")
      : `${record.fileName}.encrypted.json`
    a.download = downloadFileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(
      t(
        "history.successDownloadEncrypted",
        "Encrypted file downloaded. Unlock your account to download decrypted version.",
      ),
    )
    return
  }

  // Process data (decrypt + decompress).
  const processedData = await processFileData(
    data,
    record,
    decodedTags,
    masterKey,
    decrypt,
  )

  // Ensure processedData is a standard Uint8Array.
  const finalBuffer = new ArrayBuffer(processedData.length)
  const finalArray = new Uint8Array(finalBuffer)
  finalArray.set(processedData)

  // Build Blob and trigger browser download.
  const blobType = record.mimeType || "application/octet-stream"
  const blob = new Blob([finalArray as unknown as BlobPart], {
    type: blobType,
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = record.fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  toast.success(t("history.successDownload"))
}
