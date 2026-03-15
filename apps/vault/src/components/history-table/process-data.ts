import type { UploadRecord } from "@/lib/utils"
import { decryptData, fromBase64, toBase64 } from "@aryxn/crypto"
import { decompressData } from "@/lib/utils"
import {
  extractCompressionInfo,
  extractEncryptionParams,
  type DecodedTag,
} from "./transaction-tags"

/**
 * Ensure data is a standard Uint8Array (not backed by SharedArrayBuffer).
 */
export function ensureStandardUint8Array(data: Uint8Array): Uint8Array {
  const buffer = new ArrayBuffer(data.length)
  const array = new Uint8Array(buffer)
  array.set(data)
  return array
}

/**
 * Get nonce (prefer transaction tags, fallback to database).
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

function normalizeBase64Input(value: string): string {
  const compact = value.replace(/\s+/g, "")
  const standard = compact.replace(/-/g, "+").replace(/_/g, "/")
  const padLength = standard.length % 4
  if (padLength === 0) {
    return standard
  }
  return standard + "=".repeat(4 - padLength)
}

/**
 * Decrypt file data.
 */
export async function decryptFileData(
  data: Uint8Array,
  record: UploadRecord,
  masterKey: Uint8Array,
  encryptionParamsTag: DecodedTag | undefined,
): Promise<Uint8Array> {
  const { nonceBase64, source } = getNonce(encryptionParamsTag, record)
  const normalizedNonceBase64 = normalizeBase64Input(nonceBase64)

  console.log(`Using nonce from ${source}:`, {
    nonceBase64: nonceBase64.substring(0, 20) + "...",
    normalizedNonceBase64: normalizedNonceBase64.substring(0, 20) + "...",
    nonceLength: nonceBase64.length,
    normalizedNonceLength: normalizedNonceBase64.length,
  })

  let nonceBytes: Uint8Array
  try {
    nonceBytes = fromBase64(normalizedNonceBase64)
  } catch {
    throw new Error("Invalid nonce encoding in encryption parameters.")
  }

  // Debug information.
  console.log("Decryption info:", {
    nonceSource: source,
    nonceLength: nonceBytes.length,
    expectedNonceLength: 24,
    ciphertextLength: data.length,
    masterKeyLength: masterKey.length,
  })

  // Validate nonce length.
  if (nonceBytes.length !== 24) {
    console.error("Invalid nonce length:", {
      actual: nonceBytes.length,
      expected: 24,
      nonceBase64: normalizedNonceBase64.substring(0, 50),
    })
    throw new Error(
      `Invalid nonce length: expected 24 bytes, got ${nonceBytes.length} bytes. ` +
        `This might indicate corrupted encryption parameters.`,
    )
  }

  const decrypted = await decryptData(data, nonceBytes, masterKey)

  // Ensure return type is Uint8Array<ArrayBuffer>.
  return ensureStandardUint8Array(decrypted)
}

/**
 * Decompress file data.
 */
export async function decompressFileData(
  data: Uint8Array,
  compressionEnabled: boolean,
  compressionAlgo: string | undefined,
): Promise<Uint8Array> {
  // Detect gzip format (magic bytes: 0x1f 0x8b).
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

  // Attempt decompression if metadata indicates compression or payload looks like gzip.
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
        // If gzip is only detected heuristically and not explicitly marked, keep original data.
        return data
      }
    }
  }

  return data
}

/**
 * Process file data (decrypt + decompress).
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

  // 1) Decrypt first (when encrypted and decryption is requested).
  if (decrypt && record.encryptionAlgo !== "none" && masterKey) {
    processedData = await decryptFileData(
      processedData,
      record,
      masterKey,
      encryptionParamsTag,
    )
  }

  // 2) Decompress next (when compressed).
  // Notes:
  // - For encrypted files, compressed bytes are inside ciphertext, so decompression is only possible after decryption.
  // - For unencrypted files, compressed bytes are directly available and can be decompressed immediately.
  const shouldDecompress =
    // Unencrypted files: can always attempt decompression.
    (record.encryptionAlgo === "none" &&
      (compressionEnabled ||
        (processedData.length >= 2 &&
          processedData[0] === 0x1f &&
          processedData[1] === 0x8b))) ||
    // Encrypted files: only decompress after decryption.
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
 * Create an encrypted file package (for downloading encrypted payloads without decrypting).
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

  // Validate generated JSON content.
  try {
    JSON.parse(jsonString)
  } catch (parseError) {
    console.error("Generated JSON is invalid:", parseError)
    throw new Error("Failed to create valid JSON")
  }

  return jsonString
}
