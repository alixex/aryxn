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
