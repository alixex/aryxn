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

/**
 * 搜索结果缓存管理器
 * 支持 TTL 过期和 LRU 淘汰策略
 */
export class SearchCache {
  private cache: Map<string, CacheEntry<unknown>>
  private accessOrder: string[] = []
  private readonly maxSize: number
  private readonly defaultTtl: number

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

  /**
   * 获取缓存值
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.updateAccessOrder(key, true)
      return null
    }

    // 更新访问顺序（LRU）
    this.updateAccessOrder(key, false)

    return entry.data as T
  }

  /**
   * 设置缓存值
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // 如果缓存已满，删除最少使用的项
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
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear()
    this.accessOrder = []
  }

  /**
   * 删除特定缓存
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    this.updateAccessOrder(key, true)
    return deleted
  }

  /**
   * 获取缓存统计信息
   */
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

  /**
   * 更新访问顺序
   */
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
