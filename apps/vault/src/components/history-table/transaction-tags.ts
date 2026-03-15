/**
 * Decoded tag shape.
 */
export type DecodedTag = {
  name: string
  value: string
}

/**
 * Decode a single Arweave transaction tag.
 * Tag name/value may be base64-encoded.
 */
export function decodeTag(tag: { name: string; value: string }): DecodedTag {
  try {
    // Try decoding tag name.
    let decodedName = tag.name
    try {
      decodedName = atob(tag.name)
    } catch {
      // If decode fails, the input is likely already plain text.
      decodedName = tag.name
    }

    // Try decoding tag value.
    let decodedValue = tag.value
    try {
      decodedValue = atob(tag.value)
    } catch {
      // If decode fails, the input is likely already plain text.
      decodedValue = tag.value
    }

    return { name: decodedName, value: decodedValue }
  } catch {
    return { name: tag.name, value: tag.value }
  }
}

/**
 * Decode all transaction tags.
 */
export function decodeTransactionTags(
  tags: Array<{ name: string; value: string }> | undefined,
): DecodedTag[] {
  if (!tags) return []
  return tags.map(decodeTag)
}

/**
 * Extract compression metadata from decoded tags.
 */
export function extractCompressionInfo(decodedTags: DecodedTag[]) {
  const compressionEnabledTag = decodedTags.find(
    (t) => t.name === "Compression-Enabled",
  )
  const compressionAlgoTag = decodedTags.find(
    (t) => t.name === "Compression-Algo",
  )

  return {
    compressionEnabled: compressionEnabledTag?.value === "true",
    compressionAlgo: compressionAlgoTag?.value,
    compressionEnabledTag,
    compressionAlgoTag,
  }
}

/**
 * Extract encryption parameters from decoded tags.
 */
export function extractEncryptionParams(decodedTags: DecodedTag[]) {
  const encryptionParamsTag = decodedTags.find(
    (t) => t.name === "Encryption-Params",
  )

  return {
    encryptionParamsTag,
    hasEncryptionParams: !!encryptionParamsTag,
  }
}
