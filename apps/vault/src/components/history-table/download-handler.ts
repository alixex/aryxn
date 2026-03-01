import type { UploadRecord } from "@/lib/utils"
import { toast } from "sonner"
import type { TFunction } from "i18next"
import {
  getTransactionMetadata,
  downloadTransactionData,
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
 * 下载文件的主处理函数
 */
export async function handleFileDownload(
  record: UploadRecord,
  masterKey: Uint8Array | null,
  decrypt: boolean,
  t: TFunction<"translation", undefined>,
): Promise<void> {
  // 获取 transaction 元数据
  const { transaction, expectedDataSize } = await getTransactionMetadata(
    record.txId,
  )

  // 下载数据
  const data = await downloadTransactionData(record.txId, expectedDataSize)

  // 解码 transaction tags
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

  // 如果下载加密文件但不解密，打包成 JSON
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

  // 处理数据（解密和解压）
  const processedData = await processFileData(
    data,
    record,
    decodedTags,
    masterKey,
    decrypt,
  )

  // 确保 processedData 是标准的 Uint8Array
  const finalBuffer = new ArrayBuffer(processedData.length)
  const finalArray = new Uint8Array(finalBuffer)
  finalArray.set(processedData)

  // 创建 Blob 并下载
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
