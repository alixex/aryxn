/**
 * 配置导入导出工具函数
 * 用于在不同设备间同步账户配置
 */

import { db } from "@/lib/database"
import type { DbRow } from "@aryxn/storage"
import type {
  WalletRecord,
  UploadRecord,
  VaultMetadata,
} from "@aryxn/wallet-core"
import { searchFiles, type FileIndex } from "@/lib/file"
import {
  deriveKey,
  encryptData,
  decryptData,
  toBase64,
  fromBase64,
  toBytes,
  fromBytes,
} from "@aryxn/crypto"

const VAULT_SALT_LEGACY = new Uint8Array([
  0x61, 0x6e, 0x61, 0x6d, 0x6e, 0x65, 0x73, 0x69, 0x73, 0x2d, 0x76, 0x61, 0x75,
  0x6c, 0x74, 0x31,
])

export interface ConfigExport {
  version: string
  exportDate: number
  wallets: WalletRecord[]
  vaultMetadata: VaultMetadata[]
  uploads?: UploadRecord[]
  salt?: string // Base64 encoded salt
}

const CONFIG_VERSION = "1.0.0"

// 将 FileIndex 转换为 UploadRecord 格式
function fileIndexToUploadRecord(file: FileIndex): UploadRecord {
  return {
    id: undefined,
    txId: file.tx_id,
    fileName: file.file_name,
    fileHash: file.file_hash,
    storageType: file.storage_type as "arweave",
    ownerAddress: file.owner_address,
    encryptionAlgo: file.encryption_algo,
    encryptionParams: file.encryption_params,
    createdAt: file.created_at,
  }
}

/**
 * 导出当前 vault 的所有配置
 * @param vaultId 当前 vault ID
 * @param includeUploads 是否包含上传记录
 * @returns 配置导出对象
 */
export async function exportConfig(
  vaultId: string,
  includeUploads = false,
): Promise<ConfigExport> {
  // 获取所有钱包记录（从 SQLite）
  const walletRows = await db.all("SELECT * FROM wallets WHERE vault_id = ?", [
    vaultId,
  ])
  const wallets: WalletRecord[] = walletRows.map((row: DbRow) => ({
    id: typeof row.id === "number" ? row.id : undefined,
    address: String(row.address),
    encryptedKey: String(row.encrypted_key),
    alias: String(row.alias),
    chain: row.chain as WalletRecord["chain"],
    vaultId: String(row.vault_id),
    createdAt:
      typeof row.created_at === "number"
        ? row.created_at
        : Number(row.created_at),
  }))

  // 获取所有 vault 元数据（只包含当前 vault 相关的）
  const allVaultRows = await db.all("SELECT * FROM vault_metadata")
  const vaultMetadata: VaultMetadata[] = allVaultRows
    .filter((row: DbRow) => String(row.key).includes(vaultId))
    .map((row: DbRow) => ({
      key: String(row.key),
      value: String(row.value),
    }))

  // 可选：获取上传记录（从 SQLite）
  let uploads: UploadRecord[] | undefined
  if (includeUploads) {
    try {
      // 获取所有钱包地址
      const walletAddresses = wallets.map((w) => w.address)

      // 从 SQLite 加载
      const sqliteFiles: FileIndex[] = []
      for (const address of walletAddresses) {
        try {
          const files = await searchFiles(address, { limit: 10000 })
          sqliteFiles.push(...files)
        } catch (error) {
          console.warn(`Failed to load files for ${address}:`, error)
        }
      }

      uploads = sqliteFiles.map(fileIndexToUploadRecord)
    } catch (error) {
      console.error("Failed to load uploads:", error)
      uploads = []
    }
  }

  // 获取当前 vault 的盐
  const saltRecord = await db.get(
    "SELECT value FROM vault_metadata WHERE key = ?",
    [`global_vault_salt_${vaultId}`],
  )

  return {
    version: CONFIG_VERSION,
    exportDate: Date.now(),
    wallets,
    vaultMetadata,
    uploads,
    salt: saltRecord?.value ? String(saltRecord.value) : undefined,
  }
}

/**
 * 导入配置到当前 vault
 * @param config 配置对象
 * @param targetVaultId 目标 vault ID（当前 vault）
 * @param sourcePassword 源 vault 的密码（用于解密导入的钱包密钥）
 * @param targetMasterKey 目标 vault 的主密钥（用于重新加密钱包密钥）
 * @param options 导入选项
 * @returns 导入结果
 */
export async function importConfig(
  config: ConfigExport,
  targetVaultId: string,
  sourcePassword: string,
  targetMasterKey: Uint8Array,
  options: {
    overwriteExisting?: boolean // 是否覆盖已存在的钱包
    importUploads?: boolean // 是否导入上传记录
  } = {},
): Promise<{
  success: boolean
  importedWallets: number
  importedMetadata: number
  importedUploads: number
  errors: string[]
}> {
  const errors: string[] = []
  let importedWallets = 0
  let importedMetadata = 0
  let importedUploads = 0

  try {
    // 验证配置版本
    if (config.version !== CONFIG_VERSION) {
      errors.push(
        `不支持的配置版本：${config.version}，当前版本：${CONFIG_VERSION}`,
      )
    }

    // 导入钱包
    if (config.wallets && Array.isArray(config.wallets)) {
      // 派生源 vault 的密钥
      // 如果导入的配置中有盐，则使用它；否则退回到老代码的硬编码盐
      const sourceSalt = config.salt
        ? fromBase64(config.salt)
        : VAULT_SALT_LEGACY
      const sourceKey = await deriveKey(sourcePassword, sourceSalt)

      for (const wallet of config.wallets) {
        try {
          // 解密源钱包密钥
          const { ciphertext, nonce } = JSON.parse(wallet.encryptedKey)
          const decryptedData = await decryptData(
            fromBase64(ciphertext),
            fromBase64(nonce),
            sourceKey,
          )
          const walletData = JSON.parse(fromBytes(decryptedData))

          // 用目标 vault 的密钥重新加密
          const storageData = JSON.stringify(walletData)
          const { ciphertext: newCiphertext, nonce: newNonce } =
            await encryptData(toBytes(storageData), targetMasterKey)

          // 创建新的加密密钥字符串
          const newEncryptedKey = JSON.stringify({
            ciphertext: toBase64(newCiphertext),
            nonce: toBase64(newNonce),
          })

          // 检查是否已存在相同地址的钱包
          const existing = await db.get(
            "SELECT id FROM wallets WHERE address = ? AND vault_id = ?",
            [wallet.address, targetVaultId],
          )

          if (existing) {
            if (options.overwriteExisting) {
              // 更新现有钱包
              await db.run(
                `UPDATE wallets 
                 SET encrypted_key = ?, alias = ?, chain = ?
                 WHERE id = ?`,
                [newEncryptedKey, wallet.alias, wallet.chain, existing.id],
              )
              importedWallets++
            } else {
              // 跳过已存在的钱包
              errors.push(`钱包 ${wallet.address} 已存在，已跳过`)
            }
          } else {
            // 添加新钱包
            await db.run(
              `INSERT INTO wallets (address, encrypted_key, alias, chain, vault_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                wallet.address,
                newEncryptedKey,
                wallet.alias,
                wallet.chain,
                targetVaultId,
                wallet.createdAt,
              ],
            )
            importedWallets++
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          errors.push(
            `导入钱包失败 ${wallet.address}: ${errorMessage}（可能是密码错误）`,
          )
        }
      }
    }

    // 导入 vault 元数据
    if (config.vaultMetadata && Array.isArray(config.vaultMetadata)) {
      for (const meta of config.vaultMetadata) {
        try {
          // 更新 key 中的 vaultId 为目标 vault
          // vault 元数据的 key 格式通常是："active_address_<vaultId>" 或 "use_external_<vaultId>"
          const oldKey = meta.key
          // 提取 key 的前缀部分（去掉旧的 vaultId）
          const keyPrefix = oldKey.replace(/_[a-f0-9]{16}$/, "")
          const newKey = `${keyPrefix}_${targetVaultId}`

          // 检查是否已存在
          const existing = await db.get(
            "SELECT key FROM vault_metadata WHERE key = ?",
            [newKey],
          )
          if (existing) {
            if (options.overwriteExisting) {
              await db.run(
                "UPDATE vault_metadata SET value = ? WHERE key = ?",
                [meta.value, newKey],
              )
              importedMetadata++
            } else {
              // 跳过已存在的元数据（不记录为错误，因为这是正常的）
              importedMetadata++
            }
          } else {
            await db.run(
              "INSERT INTO vault_metadata (key, value) VALUES (?, ?)",
              [newKey, meta.value],
            )
            importedMetadata++
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          errors.push(`导入元数据失败 ${meta.key}: ${errorMessage}`)
        }
      }
    }

    // 导入上传记录（可选）
    if (
      options.importUploads &&
      config.uploads &&
      Array.isArray(config.uploads)
    ) {
      for (const upload of config.uploads) {
        try {
          // 检查 SQLite 中是否已存在
          const existing = await db.get(
            "SELECT id FROM file_indexes WHERE tx_id = ?",
            [upload.txId],
          )

          if (existing) {
            if (options.overwriteExisting) {
              // 更新 SQLite
              await db.run(
                `UPDATE file_indexes 
                 SET file_name = ?, owner_address = ?, encryption_algo = ?, encryption_params = ?
                 WHERE tx_id = ?`,
                [
                  upload.fileName,
                  upload.ownerAddress,
                  upload.encryptionAlgo,
                  upload.encryptionParams,
                  upload.txId,
                ],
              )
              importedUploads++
            } else {
              errors.push(`上传记录 ${upload.txId} 已存在，已跳过`)
            }
          } else {
            // 写入 SQLite
            const fileId = crypto.randomUUID()
            await db.run(
              `INSERT INTO file_indexes (
                id, tx_id, file_name, file_hash, file_size, mime_type,
                folder_id, description, owner_address, storage_type,
                encryption_algo, encryption_params, version, previous_tx_id,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                fileId,
                upload.txId,
                upload.fileName,
                upload.fileHash || "",
                0, // 文件大小未知
                "application/octet-stream",
                null,
                null,
                upload.ownerAddress,
                upload.storageType,
                upload.encryptionAlgo,
                upload.encryptionParams,
                1,
                null,
                upload.createdAt,
                upload.createdAt,
              ],
            )

            // 更新全文搜索索引
            const fileRecord = await db.get(
              "SELECT rowid FROM file_indexes WHERE id = ?",
              [fileId],
            )
            if (fileRecord) {
              await db.run(
                `INSERT INTO file_indexes_fts (rowid, file_name, description)
                 VALUES (?, ?, ?)`,
                [fileRecord.rowid, upload.fileName, ""],
              )
            }

            importedUploads++
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          errors.push(`导入上传记录失败 ${upload.txId}: ${errorMessage}`)
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    errors.push(`导入过程出错：${errorMessage}`)
  }

  return {
    success: errors.length === 0,
    importedWallets,
    importedMetadata,
    importedUploads,
    errors,
  }
}

/**
 * 验证配置格式
 */
export function validateConfig(config: unknown): config is ConfigExport {
  if (!config || typeof config !== "object") {
    return false
  }

  const configObj = config as Record<string, unknown>

  if (!configObj.version || typeof configObj.version !== "string") {
    return false
  }

  if (!Array.isArray(configObj.wallets)) {
    return false
  }

  if (!Array.isArray(configObj.vaultMetadata)) {
    return false
  }

  // 验证钱包记录格式
  for (const wallet of configObj.wallets) {
    if (
      !wallet.address ||
      !wallet.encryptedKey ||
      !wallet.alias ||
      !wallet.chain ||
      !wallet.vaultId
    ) {
      return false
    }
  }

  // 验证元数据格式
  for (const meta of configObj.vaultMetadata) {
    if (!meta.key || meta.value === undefined) {
      return false
    }
  }

  return true
}

/**
 * 下载配置为 JSON 文件
 */
export function downloadConfig(config: ConfigExport, filename?: string): void {
  const json = JSON.stringify(config, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename || `aryxn-config-${Date.now()}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 从文件读取配置
 */
export function readConfigFromFile(file: File): Promise<ConfigExport> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const config = JSON.parse(text)
        if (validateConfig(config)) {
          resolve(config)
        } else {
          reject(new Error("配置文件格式无效"))
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        reject(new Error(`读取配置文件失败：${errorMessage}`))
      }
    }
    reader.onerror = () => {
      reject(new Error("读取文件失败"))
    }
    reader.readAsText(file)
  })
}
