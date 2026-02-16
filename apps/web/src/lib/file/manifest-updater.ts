/**
 * 清单文件批量更新管理器
 * 实现延迟批量更新机制，减少清单文件数量和存储费用
 */

import { updateManifestAfterUpload } from "./file-sync"
import type { WalletKey } from "./types"

interface ManifestUpdateConfig {
  /** 立即更新的阈值（文件数量） */
  immediateThreshold: number
  /** 批量更新的延迟（毫秒） */
  batchDelay: number
  /** 最大批量大小（文件数量） */
  maxBatchSize: number
}

const DEFAULT_CONFIG: ManifestUpdateConfig = {
  immediateThreshold: 20, // 如果新增文件 >= 20，立即更新
  batchDelay: 10000, // 10秒后批量更新
  maxBatchSize: 50, // 最多50个文件批量更新
}

interface PendingUpdate {
  ownerAddress: string
  key: WalletKey
  useExternalWallet?: boolean
  fileCount: number
  lastUpdateTime: number
}

class ManifestUpdater {
  private config: ManifestUpdateConfig
  private pendingUpdates: Map<string, PendingUpdate> = new Map()
  private updateTimers: Map<string, number> = new Map()
  private isUpdating: Set<string> = new Set()

  constructor(config?: Partial<ManifestUpdateConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 标记需要更新清单
   * @param ownerAddress 账户地址
   * @param key 钱包密钥
   * @param useExternalWallet 是否使用外部钱包
   */
  scheduleUpdate(
    ownerAddress: string,
    key: WalletKey,
    useExternalWallet?: boolean,
  ): void {
    const existing = this.pendingUpdates.get(ownerAddress)

    if (existing) {
      // 更新待更新信息
      existing.fileCount += 1
      existing.lastUpdateTime = Date.now()
    } else {
      // 创建新的待更新记录
      this.pendingUpdates.set(ownerAddress, {
        ownerAddress,
        key,
        useExternalWallet,
        fileCount: 1,
        lastUpdateTime: Date.now(),
      })
    }

    const pending = this.pendingUpdates.get(ownerAddress)!

    // 如果达到立即更新阈值，立即更新
    if (pending.fileCount >= this.config.immediateThreshold) {
      this.updateNow(ownerAddress)
      return
    }

    // 否则，延迟批量更新
    this.scheduleBatchUpdate(ownerAddress)
  }

  /**
   * 立即更新清单
   */
  private async updateNow(ownerAddress: string): Promise<void> {
    const pending = this.pendingUpdates.get(ownerAddress)
    if (!pending) {
      return
    }

    // 如果正在更新，跳过
    if (this.isUpdating.has(ownerAddress)) {
      return
    }

    // 清除定时器
    const timer = this.updateTimers.get(ownerAddress)
    if (timer) {
      clearTimeout(timer)
      this.updateTimers.delete(ownerAddress)
    }

    // 标记为正在更新
    this.isUpdating.add(ownerAddress)

    try {
      console.log(
        `[ManifestUpdater] Updating manifest immediately for ${ownerAddress} (${pending.fileCount} files)`,
      )

      await updateManifestAfterUpload(
        ownerAddress,
        pending.key,
        pending.useExternalWallet,
      )

      // 清除待更新记录
      this.pendingUpdates.delete(ownerAddress)
    } catch (error) {
      console.error(
        `[ManifestUpdater] Failed to update manifest for ${ownerAddress}:`,
        error,
      )
      // 更新失败，保留待更新记录，稍后重试
    } finally {
      this.isUpdating.delete(ownerAddress)
    }
  }

  /**
   * 安排批量更新
   */
  private scheduleBatchUpdate(ownerAddress: string): void {
    // 如果已有定时器，清除它（重置延迟）
    const existingTimer = this.updateTimers.get(ownerAddress)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // 创建新的定时器
    const timer = setTimeout(async () => {
      await this.updateNow(ownerAddress)
      this.updateTimers.delete(ownerAddress)
    }, this.config.batchDelay) as unknown as number

    this.updateTimers.set(ownerAddress, timer)
  }

  /**
   * 手动触发更新（用于测试或特殊情况）
   */
  async forceUpdate(
    ownerAddress: string,
    key: WalletKey,
    useExternalWallet?: boolean,
  ): Promise<void> {
    // 清除待更新记录和定时器
    this.pendingUpdates.delete(ownerAddress)
    const timer = this.updateTimers.get(ownerAddress)
    if (timer) {
      clearTimeout(timer)
      this.updateTimers.delete(ownerAddress)
    }

    // 立即更新
    await updateManifestAfterUpload(ownerAddress, key, useExternalWallet)
  }

  /**
   * 获取待更新的文件数量
   */
  getPendingFileCount(ownerAddress: string): number {
    const pending = this.pendingUpdates.get(ownerAddress)
    return pending?.fileCount || 0
  }

  /**
   * 清除待更新记录（用于清理）
   */
  clearPending(ownerAddress: string): void {
    this.pendingUpdates.delete(ownerAddress)
    const timer = this.updateTimers.get(ownerAddress)
    if (timer) {
      clearTimeout(timer)
      this.updateTimers.delete(ownerAddress)
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ManifestUpdateConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// 单例实例
export const manifestUpdater = new ManifestUpdater()

/**
 * 标记需要更新清单（便捷函数）
 */
export function scheduleManifestUpdate(
  ownerAddress: string,
  key: WalletKey,
  useExternalWallet?: boolean,
): void {
  manifestUpdater.scheduleUpdate(ownerAddress, key, useExternalWallet)
}

/**
 * 立即更新清单（便捷函数）
 */
export async function forceManifestUpdate(
  ownerAddress: string,
  key: WalletKey,
  useExternalWallet?: boolean,
): Promise<void> {
  await manifestUpdater.forceUpdate(ownerAddress, key, useExternalWallet)
}
