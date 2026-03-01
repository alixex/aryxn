// 格式化文件大小
export function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return "-"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

// 格式化日期时间
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// 获取文件类型显示名称
export function getFileTypeDisplay(mimeType: string | undefined): string {
  if (!mimeType) return "-"
  const parts = mimeType.split("/")
  if (parts.length === 2) {
    return parts[1].toUpperCase()
  }
  return mimeType
}
