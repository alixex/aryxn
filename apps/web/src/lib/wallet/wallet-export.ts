/**
 * 钱包导出工具函数
 * 用于处理不同链类型的私钥和助记词导出
 */

export type ChainType =
  | "ethereum"
  | "arweave"
  | "solana"
  | "sui"
  | "bitcoin"
  | "other"
  | "unknown"

export interface ExportOptions {
  chain?: ChainType
  alias?: string
  address?: string
  type: "key" | "mnemonic"
  content: {
    key: string
    mnemonic?: string
  }
}

export interface ExportResult {
  content: string
  filename: string
  mimeType: string
}

/**
 * 格式化 Arweave JWK 为 JSON 字符串
 */
function formatArweaveJWK(key: string): string | null {
  try {
    const jwk = JSON.parse(key)
    if (jwk.kty === "RSA") {
      return JSON.stringify(jwk, null, 2)
    }
    return null
  } catch {
    return null
  }
}

/**
 * 根据链类型获取文件扩展名
 */
function getFileExtension(chain: ChainType, type: "key" | "mnemonic"): string {
  if (type === "mnemonic") {
    return "txt"
  }

  if (chain === "arweave") {
    return "json"
  }

  return "txt"
}

/**
 * 根据链类型获取 MIME 类型
 */
function getMimeType(chain: ChainType, type: "key" | "mnemonic"): string {
  if (type === "mnemonic") {
    return "text/plain"
  }

  if (chain === "arweave") {
    return "application/json"
  }

  return "text/plain"
}

/**
 * 生成文件名
 */
function generateFilename(
  chain: ChainType,
  type: "key" | "mnemonic",
  alias?: string,
  address?: string,
): string {
  const prefix = alias || address || "wallet"

  if (type === "mnemonic") {
    return `${prefix}-mnemonic.txt`
  }

  // 链类型映射
  const chainMap: Record<ChainType, string> = {
    ethereum: "eth",
    arweave: "arweave",
    solana: "solana",
    sui: "sui",
    bitcoin: "bitcoin",
    other: "other",
    unknown: "unknown",
  }

  const chainExt = chainMap[chain] || chain
  const fileExt = getFileExtension(chain, type)

  return `${prefix}-${chainExt}-key.${fileExt}`
}

/**
 * 格式化导出内容
 */
function formatExportContent(
  chain: ChainType,
  type: "key" | "mnemonic",
  content: { key: string; mnemonic?: string },
): string {
  if (type === "mnemonic") {
    return content.mnemonic || ""
  }

  // Arweave 需要格式化为 JSON
  if (chain === "arweave") {
    const formatted = formatArweaveJWK(content.key)
    if (formatted) {
      return formatted
    }
    // 如果不是有效的 JWK，返回原始内容
    return content.key
  }

  // 其他链直接返回私钥
  return content.key
}

/**
 * 准备导出数据
 * 根据链类型和内容类型，生成导出所需的所有信息
 */
export function prepareExport(options: ExportOptions): ExportResult {
  const { chain = "unknown", alias, address, type, content } = options

  const formattedContent = formatExportContent(chain, type, content)
  const filename = generateFilename(chain, type, alias, address)
  const mimeType = getMimeType(chain, type)

  return {
    content: formattedContent,
    filename,
    mimeType,
  }
}

/**
 * 执行下载
 */
export function downloadFile(result: ExportResult): void {
  const blob = new Blob([result.content], { type: result.mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = result.filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 导出钱包信息（一键导出）
 */
export function exportWallet(options: ExportOptions): void {
  const result = prepareExport(options)
  downloadFile(result)
}
