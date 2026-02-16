/**
 * 搜索结果缓存管理
 * 提供 LRU 缓存机制，避免重复查询 Arweave GraphQL API
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface SearchCacheConfig {
  maxSize?: number
  defaultTtl?: number
}

import {
  encryptStringForStorage,
  decryptStringFromStorage,
} from "@aryxn/crypto"
import { persistEncrypted, loadEncrypted } from "@aryxn/storage"

const PERSIST_KEY = "@aryxn/arweave:search-cache"

/**
 * 搜索结果缓存管理器
 * 支持 TTL 过期、LRU 淘汰策略以及可选的加密持久化
 */
export class SearchCache {
  private cache: Map<string, CacheEntry<unknown>>
  private accessOrder: string[] = []
  private readonly maxSize: number
  private readonly defaultTtl: number
  private persistenceEnabled = false
  private masterKey: string | null = null

  constructor(config: SearchCacheConfig = {}) {
    this.maxSize = config.maxSize ?? 100
    this.defaultTtl = config.defaultTtl ?? 5 * 60 * 1000 // 默认 5 分钟
    this.cache = new Map()
  }

  /**
   * 生成缓存键
   */
  generateKey(params: Record<string, any>): string {
    const keys = Object.keys(params).sort()
    const values = keys.map((k) => {
      const v = params[k]
      return `${k}:${typeof v === "object" ? JSON.stringify(v) : String(v)}`
    })
    return values.join("|")
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) return null

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.updateAccessOrder(key, true)
      if (this.persistenceEnabled) this.persist().catch(() => {})
      return null
    }

    this.updateAccessOrder(key, false)
    return entry.data as T
  }

  set<T>(key: string, data: T, ttl?: number): void {
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      const lruKey = this.accessOrder[0]
      if (lruKey) {
        this.cache.delete(lruKey)
        this.accessOrder.shift()
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTtl,
    })

    this.updateAccessOrder(key, false)

    if (this.persistenceEnabled) {
      this.persist().catch((e) => console.warn("Persist failed:", e))
    }
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder = []
    if (this.persistenceEnabled) this.persist().catch(() => {})
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    this.updateAccessOrder(key, true)
    if (this.persistenceEnabled) this.persist().catch(() => {})
    return deleted
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        ttl: entry.ttl,
        expired: Date.now() - entry.timestamp > entry.ttl,
      })),
    }
  }

  async enablePersistence(masterKey: string) {
    this.persistenceEnabled = true
    this.masterKey = masterKey
    await this.loadPersisted()
  }

  disablePersistence() {
    this.persistenceEnabled = false
    this.masterKey = null
  }

  /**
   * 将缓存序列化并加密后持久化
   */
  private async persist(): Promise<void> {
    if (!this.persistenceEnabled || !this.masterKey) return

    try {
      const payload = JSON.stringify(Array.from(this.cache.entries()))
      const encrypted = await encryptStringForStorage(payload, this.masterKey)
      await persistEncrypted(PERSIST_KEY, encrypted)
    } catch (e) {
      console.warn("Failed to persist cache:", e)
    }
  }

  /**
   * 从持久化存储加载并解密缓存
   */
  private async loadPersisted(): Promise<void> {
    if (!this.masterKey) return

    try {
      const stored = await loadEncrypted(PERSIST_KEY)
      if (stored) {
        const decrypted = await decryptStringFromStorage(stored, this.masterKey)
        const entries: Array<[string, CacheEntry<unknown>]> =
          JSON.parse(decrypted)
        this.cache = new Map(entries)
        this.accessOrder = entries.map(([k]) => k)
      }
    } catch (e) {
      console.warn("Failed to load persisted cache:", e)
    }
  }

  private updateAccessOrder(key: string, remove: boolean): void {
    const index = this.accessOrder.indexOf(key)

    if (index !== -1) {
      this.accessOrder.splice(index, 1)
    }

    if (!remove) {
      this.accessOrder.push(key)
    }
  }
}

/**
 * 全局搜索缓存实例
 */
const globalSearchCache = new SearchCache({
  maxSize: 100,
  defaultTtl: 5 * 60 * 1000, // 5 分钟
})

export function getSearchCache(): SearchCache {
  return globalSearchCache
}

export function resetSearchCache(): void {
  globalSearchCache.clear()
}

export async function enableSearchCachePersistence(masterKey: string) {
  return globalSearchCache.enablePersistence(masterKey)
}

export function disableSearchCachePersistence() {
  return globalSearchCache.disablePersistence()
}
