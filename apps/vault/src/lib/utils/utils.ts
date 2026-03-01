import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化文件大小为人类可读的格式
 * @param bytes 文件大小（字节）
 * @param decimals 小数位数，默认为 2
 * @returns 格式化后的字符串，如 "1.5 MB"
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

/**
 * 缩短地址显示
 * @param addr 完整地址
 * @returns 缩短后的地址，格式为 "xxxxx...xxxx"
 */
export function shortenedAddress(addr: string): string {
  return `${addr.slice(0, 5)}...${addr.slice(-4)}`
}

/**
 * 格式化时间戳为 "YYYY-MM-DD HH:mm:ss" 格式
 * @param timestamp 时间戳 (毫秒)
 * @returns 格式化后的时间字符串
 */
export function formatTimestamp(timestamp: number | string | Date): string {
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return "N/A"

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}
