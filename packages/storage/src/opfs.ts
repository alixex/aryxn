import { OpfsFileInfo } from "./types"

/**
 * 列出 OPFS 中的所有文件及其大小（用于调试）
 */
export async function listOpfsFiles(): Promise<string[]> {
  const result: string[] = []

  try {
    if (
      typeof navigator === "undefined" ||
      !navigator.storage ||
      !navigator.storage.getDirectory
    ) {
      return ["OPFS not supported in this environment"]
    }

    const opfsRoot = await navigator.storage.getDirectory()

    async function traverseDirectory(
      dir: FileSystemDirectoryHandle,
      path = "",
      depth = 0,
    ): Promise<void> {
      if (depth > 5) return // Prevent infinite recursion

      for await (const [name, handle] of (dir as any).entries()) {
        const fullPath = path ? `${path}/${name}` : name
        if (handle.kind === "file") {
          const file = await (handle as FileSystemFileHandle).getFile()
          result.push(`${fullPath} (${file.size} bytes)`)
        } else if (handle.kind === "directory") {
          result.push(`${fullPath}/`)
          await traverseDirectory(
            handle as FileSystemDirectoryHandle,
            fullPath,
            depth + 1,
          )
        }
      }
    }

    await traverseDirectory(opfsRoot)
  } catch (error) {
    console.warn("Failed to list OPFS files:", error)
    result.push(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  return result
}

/**
 * 获取 OPFS 文件及其大小信息
 */
export async function getOpfsFilesWithSize(): Promise<OpfsFileInfo[]> {
  const result: OpfsFileInfo[] = []

  try {
    if (
      typeof navigator === "undefined" ||
      !navigator.storage ||
      !navigator.storage.getDirectory
    ) {
      return []
    }

    const opfsRoot = await navigator.storage.getDirectory()

    async function traverseDirectory(
      dir: FileSystemDirectoryHandle,
      path = "",
      depth = 0,
    ): Promise<void> {
      if (depth > 5) return

      for await (const [name, handle] of (dir as any).entries()) {
        const fullPath = path ? `${path}/${name}` : name
        if (handle.kind === "file") {
          const file = await (handle as FileSystemFileHandle).getFile()
          result.push({
            name,
            size: file.size,
            path: fullPath,
          })
        } else if (handle.kind === "directory") {
          await traverseDirectory(
            handle as FileSystemDirectoryHandle,
            fullPath,
            depth + 1,
          )
        }
      }
    }

    await traverseDirectory(opfsRoot)
  } catch (error) {
    console.warn("Failed to get OPFS files with size:", error)
  }

  return result
}

/**
 * 直接通过 OPFS API 删除数据库文件
 */
export async function deleteOpfsDatabaseFile(): Promise<void> {
  try {
    if (
      typeof navigator === "undefined" ||
      !navigator.storage ||
      !navigator.storage.getDirectory
    ) {
      throw new Error("OPFS not supported")
    }

    const opfsRoot = await navigator.storage.getDirectory()

    // Check for the known database file name
    const DB_FILE_NAME = "aryxn.db"

    try {
      await opfsRoot.removeEntry(DB_FILE_NAME)
      console.log(`Deleted ${DB_FILE_NAME} from OPFS`)
    } catch (e: any) {
      if (e.name === "NotFoundError") {
        console.log(`${DB_FILE_NAME} not found in OPFS`)
      } else {
        throw e
      }
    }
  } catch (error) {
    console.error("Failed to delete database from OPFS:", error)
    throw error
  }
}
