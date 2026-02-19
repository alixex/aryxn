import { compress, decompress } from "fflate"

/**
 * 压缩数据（使用 gzip）
 * @param data 要压缩的数据
 * @returns 压缩后的数据
 */
export async function compressData(data: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    compress(data, { level: 6 }, (err, compressed) => {
      if (err) {
        reject(err)
        return
      }
      resolve(compressed)
    })
  })
}

/**
 * 解压数据（gzip）
 * @param compressedData 压缩的数据
 * @returns 解压后的原始数据
 */
export async function decompressData(
  compressedData: Uint8Array,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    decompress(compressedData, (err, decompressed) => {
      if (err) {
        reject(err)
        return
      }
      resolve(decompressed)
    })
  })
}

// 定义文件类型的接口，兼容 File 对象和上传的文件项
interface FileLike {
  size: number
  name: string
  type: string
}

/**
 * 检查文件类型是否适合压缩
 * 支持传入 File 对象或者分别传入 size, name, type
 */
export function shouldCompressFile(
  fileOrSize: number | FileLike,
  fileName?: string,
  mimeType?: string,
): boolean {
  let size: number
  let name: string
  let type: string

  if (typeof fileOrSize === "object" && fileOrSize !== null) {
    size = fileOrSize.size
    name = fileOrSize.name || ""
    type = fileOrSize.type || ""
  } else {
    size = fileOrSize as number
    name = fileName || ""
    type = mimeType || ""
  }

  const mime = type.toLowerCase()

  // 已经压缩的格式，压缩效果有限
  const compressedFormats = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
    "audio/mpeg",
    "audio/mp3",
    "application/zip",
    "application/gzip",
    "application/x-gzip",
    "application/x-compressed",
    "application/x-zip-compressed",
  ]

  // 检查文件扩展名
  const compressedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".mp4",
    ".webm",
    ".mp3",
    ".zip",
    ".gz",
    ".7z",
    ".rar",
  ]

  // 如果文件很小（< 1KB），压缩可能不值得
  if (size < 1024) {
    return false
  }

  // 检查是否是已压缩格式
  if (compressedFormats.some((fmt) => mime.includes(fmt))) {
    return false
  }

  if (compressedExtensions.some((ext) => name.endsWith(ext))) {
    return false
  }

  return true
}

/**
 * 实际压缩文件并返回压缩后的大小
 */
export async function getActualCompressedSize(
  data: Uint8Array,
  fileName: string,
  mimeType: string,
): Promise<number> {
  if (!shouldCompressFile(data.length, fileName, mimeType)) {
    return data.length
  }

  try {
    const compressed = await compressData(data)
    return compressed.length < data.length ? compressed.length : data.length
  } catch (error) {
    console.warn("Failed to compress for size calculation:", error)
    return data.length
  }
}
