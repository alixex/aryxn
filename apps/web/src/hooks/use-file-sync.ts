import { useState, useCallback } from "react"
import { toast } from "sonner"
import { useInternal, useExternalWallets } from "@/hooks/account-hooks"
import { syncFilesFromArweaveDirect } from "@/lib/file-sync-direct"

export function useFileSync() {
  const walletManager = useInternal()
  const externalWallets = useExternalWallets().external
  const [syncing, setSyncing] = useState(false)
  const [uploadingManifest] = useState(false)

  /**
   * 从 Arweave 同步 file 索引到本地
   */
  const syncFromArweave = useCallback(async () => {
    // 收集所有需要同步的地址
    const addresses: string[] = []

    if (walletManager.activeAddress) {
      addresses.push(walletManager.activeAddress)
    }

    if (externalWallets.arAddress) {
      addresses.push(externalWallets.arAddress)
    }

    if (addresses.length === 0) {
      toast.error("请先选择账户或连接外部钱包")
      return false
    }

    setSyncing(true)
    try {
      let totalAdded = 0
      let totalUpdated = 0
      let totalSkipped = 0
      let totalErrors = 0

      // 同步所有地址的文件
      for (const address of addresses) {
        const result = await syncFilesFromArweaveDirect(address)
        totalAdded += result.added
        totalUpdated += result.updated
        totalSkipped += result.skipped
        totalErrors += result.errors
      }

      if (totalAdded > 0 || totalUpdated > 0) {
        toast.success(
          `同步完成：新增 ${totalAdded} 条，更新 ${totalUpdated} 条${
            totalErrors > 0 ? `，${totalErrors} 条错误` : ""
          }`,
        )
        return true
      } else if (totalSkipped > 0) {
        toast.info("本地记录已是最新")
        return false
      } else {
        toast.info("未找到远程文件记录")
        return false
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(`同步失败：${errorMessage}`)
      return false
    } finally {
      setSyncing(false)
    }
  }, [walletManager.activeAddress, externalWallets.arAddress])

  return {
    syncing,
    uploadingManifest,
    syncFromArweave,
    uploadManifestToArweave: useCallback(async () => {
      toast.info("文件记录已通过标签自动同步")
      return false
    }, []),
  }
}
