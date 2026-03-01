/**
 * 解码后的 tag 类型
 */
export type DecodedTag = {
  name: string
  value: string
}

/**
 * 解码 Arweave transaction tag
 * Arweave transaction tags 的 name 和 value 可能是 base64 编码的
 */
export function decodeTag(tag: { name: string; value: string }): DecodedTag {
  try {
    // 尝试解码 name
    let decodedName = tag.name
    try {
      decodedName = atob(tag.name)
    } catch {
      // 如果解码失败，说明已经是字符串格式
      decodedName = tag.name
    }

    // 尝试解码 value
    let decodedValue = tag.value
    try {
      decodedValue = atob(tag.value)
    } catch {
      // 如果解码失败，说明已经是字符串格式
      decodedValue = tag.value
    }

    return { name: decodedName, value: decodedValue }
  } catch {
    return { name: tag.name, value: tag.value }
  }
}

/**
 * 解码所有 transaction tags
 */
export function decodeTransactionTags(
  tags: Array<{ name: string; value: string }> | undefined,
): DecodedTag[] {
  if (!tags) return []
  return tags.map(decodeTag)
}

/**
 * 从解码后的 tags 中提取压缩信息
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
 * 从解码后的 tags 中提取加密参数
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
