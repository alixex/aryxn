import type { UploadRecord } from "@/lib/types"
import { decryptData, fromBase64, toBase64 } from "@/lib/crypto"
import { decompressData } from "@/lib/compression"
import {
  extractCompressionInfo,
  extractEncryptionParams,
  type DecodedTag,
} from "./transaction-tags"

/**
 * 确保数据是标准的 Uint8Array（不是 SharedArrayBuffer）
 */
export function ensureStandardUint8Array(data: Uint8Array): Uint8Array {
  const buffer = new ArrayBuffer(data.length)
  const array = new Uint8Array(buffer)
  array.set(data)
  return array
}

/**
 * 获取 nonce（优先从 transaction tags，回退到数据库）
 */
function getNonce(
  encryptionParamsTag: DecodedTag | undefined,
  record: UploadRecord,
): { nonceBase64: string; source: string } {
  if (encryptionParamsTag?.value) {
    try {
      const params = JSON.parse(encryptionParamsTag.value)
      return {
        nonceBase64: params.nonce,
        source: "transaction tag",
      }
    } catch (e) {
      console.warn(
        "Failed to parse encryption params from tag, using database value:",
        e,
      )
    }
  }

  const { nonce } = JSON.parse(record.encryptionParams)
  return {
    nonceBase64: nonce,
    source: "database",
  }
}

/**
 * 解密数据
 */
export async function decryptFileData(
  data: Uint8Array,
  record: UploadRecord,
  masterKey: Uint8Array,
  encryptionParamsTag: DecodedTag | undefined,
): Promise<Uint8Array> {
  const { nonceBase64, source } = getNonce(encryptionParamsTag, record)

  console.log(`Using nonce from ${source}:`, {
    nonceBase64: nonceBase64.substring(0, 20) + "...",
    nonceLength: nonceBase64.length,
  })

  const nonceBytes = fromBase64(nonceBase64)

  // 调试信息
  console.log("Decryption info:", {
    nonceSource: source,
    nonceLength: nonceBytes.length,
    expectedNonceLength: 24,
    ciphertextLength: data.length,
    masterKeyLength: masterKey.length,
  })

  // 检查 nonce 长度是否正确
  if (nonceBytes.length !== 24) {
    console.error("Invalid nonce length:", {
      actual: nonceBytes.length,
      expected: 24,
      nonceBase64: nonceBase64.substring(0, 50),
    })
    throw new Error(
      `Invalid nonce length: expected 24 bytes, got ${nonceBytes.length} bytes. ` +
        `This might indicate corrupted encryption parameters.`,
    )
  }

  const decrypted = await decryptData(data, nonceBytes, masterKey)

  // 确保返回的是 Uint8Array<ArrayBuffer> 类型
  return ensureStandardUint8Array(decrypted)
}

/**
 * 解压数据
 */
export async function decompressFileData(
  data: Uint8Array,
  compressionEnabled: boolean,
  compressionAlgo: string | undefined,
): Promise<Uint8Array> {
  // 检查是否是 gzip 格式（gzip 魔数：0x1f 0x8b）
  const isGzipCompressed =
    data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b

  console.log("Compression check:", {
    compressionEnabled,
    compressionAlgo,
    isGzipCompressed,
    dataLength: data.length,
    firstBytes:
      data.length >= 2
        ? `0x${data[0].toString(16).padStart(2, "0")} 0x${data[1].toString(16).padStart(2, "0")}`
        : "N/A",
  })

  // 如果标记显示压缩，或者数据看起来是 gzip 格式，尝试解压
  if (compressionEnabled || isGzipCompressed) {
    if (compressionAlgo === "gzip" || isGzipCompressed) {
      try {
        console.log("Attempting decompression...")
        const decompressed = await decompressData(data)
        console.log("Decompression successful:", {
          originalSize: data.length,
          decompressedSize: decompressed.length,
          ratio:
            ((1 - decompressed.length / data.length) * 100).toFixed(2) + "%",
        })
        return ensureStandardUint8Array(decompressed)
      } catch (decompressionError) {
        console.error("Decompression failed:", decompressionError)
        if (compressionEnabled) {
          throw new Error(
            `Decompression failed: ${decompressionError instanceof Error ? decompressionError.message : String(decompressionError)}. ` +
              `The file was marked as compressed but could not be decompressed.`,
          )
        }
        // 如果只是检测到 gzip 但未标记，继续使用原始数据
        return data
      }
    }
  }

  return data
}

/**
 * 处理文件数据（解密和解压）
 */
export async function processFileData(
  data: Uint8Array,
  record: UploadRecord,
  decodedTags: DecodedTag[],
  masterKey: Uint8Array | null,
  decrypt: boolean,
): Promise<Uint8Array> {
  let processedData = ensureStandardUint8Array(data)

  const { compressionEnabled, compressionAlgo } =
    extractCompressionInfo(decodedTags)
  const { encryptionParamsTag } = extractEncryptionParams(decodedTags)

  // 1. 先解密（如果加密了且请求解密）
  if (decrypt && record.encryptionAlgo !== "none" && masterKey) {
    processedData = await decryptFileData(
      processedData,
      record,
      masterKey,
      encryptionParamsTag,
    )
  }

  // 2. 再解压（如果压缩了）
  // 注意：
  // - 如果文件是加密的，压缩数据也在加密数据内部，所以只有解密后才能解压
  // - 如果文件是未加密的，压缩数据是直接的，可以直接解压
  const shouldDecompress =
    // 未加密的文件：总是可以解压
    (record.encryptionAlgo === "none" &&
      (compressionEnabled ||
        (processedData.length >= 2 &&
          processedData[0] === 0x1f &&
          processedData[1] === 0x8b))) ||
    // 加密的文件：只有在已解密的情况下才能解压
    (record.encryptionAlgo !== "none" &&
      decrypt &&
      (compressionEnabled ||
        (processedData.length >= 2 &&
          processedData[0] === 0x1f &&
          processedData[1] === 0x8b)))

  if (shouldDecompress) {
    processedData = await decompressFileData(
      processedData,
      compressionEnabled,
      compressionAlgo,
    )
  }

  return processedData
}

/**
 * 创建加密文件包（用于下载未解密的加密文件）
 */
export function createEncryptedFilePackage(
  data: Uint8Array,
  record: UploadRecord,
  encryptionParamsTag: DecodedTag | undefined,
  compressionEnabled: boolean,
  compressionAlgo: string | undefined,
): string {
  const { nonceBase64 } = getNonce(encryptionParamsTag, record)

  const encryptedFileData = {
    version: "1.0",
    encrypted: true,
    algorithm: record.encryptionAlgo,
    nonce: nonceBase64,
    data: toBase64(data),
    fileName: record.fileName,
    mimeType: record.mimeType || "application/json",
    txId: record.txId,
    compressionEnabled: compressionEnabled || false,
    compressionAlgo: compressionAlgo || null,
    createdAt: record.createdAt,
    fileSize: record.fileSize || data.length,
  }

  const jsonString = JSON.stringify(encryptedFileData, null, 2)

  // 验证 JSON 字符串是否有效
  try {
    JSON.parse(jsonString)
  } catch (parseError) {
    console.error("Generated JSON is invalid:", parseError)
    throw new Error("Failed to create valid JSON")
  }

  return jsonString
}
