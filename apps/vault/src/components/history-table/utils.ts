// Format file size.
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

// Format date/time using the runtime locale.
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Get display name for file type.
export function getFileTypeDisplay(mimeType: string | undefined): string {
  if (!mimeType) return "-"
  const parts = mimeType.split("/")
  if (parts.length === 2) {
    return parts[1].toUpperCase()
  }
  return mimeType
}
