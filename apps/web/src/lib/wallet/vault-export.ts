/**
 * 金库导出/导入工具
 * 用于在不同设备间同步账户配置
 */

import { db } from "@/lib/database"
import type { DbRow } from "@aryxn/storage"
import type { WalletRecord, VaultMetadata } from "@aryxn/wallet-core"

export interface VaultExportData {
  version: string
  exportDate: number
  wallets: WalletRecord[]
  vaultMetadata: VaultMetadata[]
}

const EXPORT_VERSION = "1.0.0"

/**
 * 导出当前金库的所有数据
 */
export async function exportVault(vaultId: string): Promise<VaultExportData> {
  // 获取所有钱包
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

  // 获取所有 vault 元数据
  const vaultMetadata: VaultMetadata[] = []
  const vaultKeys = [`active_address_${vaultId}`, `use_external_${vaultId}`]

  for (const key of vaultKeys) {
    const record = await db.get("SELECT * FROM vault_metadata WHERE key = ?", [
      key,
    ])
    if (record) {
      const key =
        typeof record.key === "string" ? record.key : String(record.key ?? "")
      const value =
        typeof record.value === "string"
          ? record.value
          : String(record.value ?? "")
      vaultMetadata.push({
        key,
        value,
      })
    }
  }

  return {
    version: EXPORT_VERSION,
    exportDate: Date.now(),
    wallets: wallets.map(({ id: _id, ...wallet }) => wallet), // 移除 id，导入时会重新生成
    vaultMetadata,
  }
}

/**
 * 导出为 JSON 文件
 */
export async function exportVaultToFile(vaultId: string): Promise<void> {
  const data = await exportVault(vaultId)
  const json = JSON.stringify(data, null, 2)

  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `aryxn-vault-${vaultId}-${new Date().toISOString().split("T")[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 从文件导入金库数据
 */
export async function importVaultFromFile(
  file: File,
  currentVaultId: string | null,
  options?: {
    merge?: boolean // 是否合并到现有金库，还是创建新金库
  },
): Promise<{
  success: boolean
  importedWallets: number
  importedMetadata: number
  newVaultId?: string
  error?: string
}> {
  try {
    const text = await file.text()
    const data: VaultExportData = JSON.parse(text)

    // 验证数据格式
    if (!data.version || !data.wallets || !Array.isArray(data.wallets)) {
      throw new Error("Invalid export file format")
    }

    // 如果合并模式，使用当前 vaultId；否则使用导入文件中的 vaultId
    const targetVaultId =
      options?.merge && currentVaultId
        ? currentVaultId
        : data.wallets[0]?.vaultId || currentVaultId

    if (!targetVaultId) {
      throw new Error("Cannot determine target vault ID")
    }

    // 导入钱包
    let importedWallets = 0
    for (const wallet of data.wallets) {
      try {
        // 检查是否已存在相同地址和链的钱包
        const existing = await db.get(
          "SELECT id FROM wallets WHERE vault_id = ? AND address = ? AND chain = ?",
          [targetVaultId, wallet.address, wallet.chain],
        )

        if (existing) {
          if (options?.merge) {
            // 合并模式：更新现有钱包
            await db.run(
              `UPDATE wallets 
               SET encrypted_key = ?, alias = ?
               WHERE id = ?`,
              [wallet.encryptedKey, wallet.alias, existing.id],
            )
            importedWallets++
          }
          // 如果不合并，跳过已存在的钱包
        } else {
          // 添加新钱包
          await db.run(
            `INSERT INTO wallets (address, encrypted_key, alias, chain, vault_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              wallet.address,
              wallet.encryptedKey,
              wallet.alias,
              wallet.chain,
              targetVaultId,
              wallet.createdAt,
            ],
          )
          importedWallets++
        }
      } catch (error) {
        console.error("Failed to import wallet:", wallet.address, error)
      }
    }

    // 导入元数据
    let importedMetadata = 0
    for (const metadata of data.vaultMetadata || []) {
      try {
        // 更新 vaultId 引用（替换 key 中的 vaultId）
        const oldVaultId = metadata.key.match(/_(.+)$/)?.[1]
        const updatedKey = oldVaultId
          ? metadata.key.replace(oldVaultId, targetVaultId)
          : metadata.key
        await db.run(
          `INSERT OR REPLACE INTO vault_metadata (key, value) VALUES (?, ?)`,
          [updatedKey, metadata.value],
        )
        importedMetadata++
      } catch (error) {
        console.error("Failed to import metadata:", metadata.key, error)
      }
    }

    return {
      success: true,
      importedWallets,
      importedMetadata,
      newVaultId: targetVaultId,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Import failed"
    return {
      success: false,
      importedWallets: 0,
      importedMetadata: 0,
      error: errorMessage,
    }
  }
}
