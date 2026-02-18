type Locale = "en" | "zh-CN"

const translations = {
  en: {
    upload: {
      preparing: "Preparing",
      compressing: "Compressing",
      encrypting: "Encrypting",
      create_tx: "Creating transaction",
      signing: "Signing",
      uploading: "Uploading",
      complete: "Complete",
      key_required: "Key is required when not using external wallet",
      key_required_short: "Key required",
      compression_failed: "Compression failed, uploading uncompressed:",
      chunk_failed: "Chunk upload failed, retrying...",
      fee_error:
        "Failed to estimate fee, please try again later or check network connection",
    },
  },
  "zh-CN": {
    upload: {
      preparing: "准备中",
      compressing: "压缩中",
      encrypting: "加密中",
      create_tx: "创建交易",
      signing: "签名中",
      uploading: "上传中",
      complete: "完成",
      key_required: "不使用外部钱包时必须提供密钥",
      key_required_short: "需要密钥",
      compression_failed: "压缩失败，将上传未压缩数据：",
      chunk_failed: "分块上传失败，重试中...",
      fee_error: "无法获取费用信息，请稍后重试或检查网络连接",
    },
  },
}

let currentLocale: Locale = "en"

export function setLocale(locale: Locale) {
  if (translations[locale]) {
    currentLocale = locale
  } else {
    console.warn(`Locale ${locale} not supported, falling back to en`)
  }
}

export function t(key: string): string {
  const keys = key.split(".")
  let value: any = translations[currentLocale]

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k]
    } else {
      // Fallback to English if translation missing
      value = translations["en"]
      for (const fallbackK of keys) {
        if (value && typeof value === "object" && fallbackK in value) {
          value = value[fallbackK]
        } else {
          return key
        }
      }
      return value as string
    }
  }

  return value as string
}
