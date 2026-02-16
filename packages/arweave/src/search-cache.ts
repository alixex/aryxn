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

const PERSIST_KEY = "@aryxn/arweave:search-cache"

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  )
}

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

  enablePersistence(masterKey: string) {
    this.persistenceEnabled = true
    this.masterKey = masterKey
    return this.loadPersisted().catch((e) => {
      console.warn("Failed to load persisted cache:", e)
    })
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

    const payload = JSON.stringify(Array.from(this.cache.entries()))

    const encrypted = await encryptString(payload, this.masterKey)

    if (isBrowser()) {
      try {
        window.localStorage.setItem(PERSIST_KEY, JSON.stringify(encrypted))
      } catch (e) {
        console.warn("Failed to write cache to localStorage:", e)
      }
    } else {
      try {
        // write to file in package root
        const fs = await import("fs")
        const path = await import("path")
        const filePath = path.join(process.cwd(), ".arweave-search-cache.json")
        await fs.promises.writeFile(
          filePath,
          JSON.stringify(encrypted),
          "utf-8",
        )
      } catch (e) {
        console.warn("Failed to write cache to file:", e)
      }
    }
  }

  /**
   * 从持久化存储加载并解密缓存
   */
  private async loadPersisted(): Promise<void> {
    if (!this.masterKey) return

    let stored: any = null

    if (isBrowser()) {
      try {
        const raw = window.localStorage.getItem(PERSIST_KEY)
        if (!raw) return
        stored = JSON.parse(raw)
      } catch (e) {
        console.warn("Failed to read cache from localStorage:", e)
        return
      }
    } else {
      try {
        const fs = await import("fs")
        const path = await import("path")
        const filePath = path.join(process.cwd(), ".arweave-search-cache.json")
        if (!fs.existsSync(filePath)) return
        const raw = await fs.promises.readFile(filePath, "utf-8")
        stored = JSON.parse(raw)
      } catch (e) {
        console.warn("Failed to read cache from file:", e)
        return
      }
    }

    if (!stored) return

    try {
      const decrypted = await decryptString(stored, this.masterKey)
      const entries: Array<[string, CacheEntry<unknown>]> =
        JSON.parse(decrypted)
      this.cache = new Map(entries)
      this.accessOrder = entries.map(([k]) => k)
    } catch (e) {
      console.warn("Failed to decrypt persisted cache:", e)
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

/**
 * 加密/解密辅助（支持浏览器 SubtleCrypto 与 Node crypto）
 */
async function getCrypto(): Promise<any> {
  if (
    typeof globalThis !== "undefined" &&
    (globalThis as any).crypto &&
    (globalThis as any).crypto.subtle
  ) {
    return (globalThis as any).crypto
  }
  try {
    // Node >= 16: globalThis.crypto.webcrypto
    // Fallback to require('crypto')
    const nodeCrypto = await import("crypto")
    return nodeCrypto
  } catch (e) {
    throw new Error("No crypto available for encryption")
  }
}

async function deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array) {
  const c = await getCrypto()
  // browser subtle
  if ((c as any).subtle) {
    const enc = new TextEncoder()
    const baseKey = await (c as any).subtle.importKey(
      "raw",
      enc.encode(passphrase),
      { name: "PBKDF2" },
      false,
      ["deriveKey"],
    )
    const key = await (c as any).subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    )
    return key
  }

  // Node fallback: return HMAC-derived key buffer
  const pbkdf2 = (await import("crypto")).pbkdf2Sync
  const keyBuf = pbkdf2(passphrase, Buffer.from(salt), 100000, 32, "sha256")
  return keyBuf
}

async function encryptString(plain: string, passphrase: string) {
  const c = await getCrypto()
  const salt = cryptoRandom(16)
  const iv = cryptoRandom(12)

  if ((c as any).subtle) {
    const key = await deriveKeyFromPassphrase(passphrase, salt)
    const enc = new TextEncoder()
    const cipher = await (c as any).subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(plain),
    )
    return {
      salt: bufferToBase64(salt),
      iv: bufferToBase64(iv),
      data: bufferToBase64(new Uint8Array(cipher)),
    }
  }

  // Node
  const crypto = await import("crypto")
  const keyBuf = (await deriveKeyFromPassphrase(passphrase, salt)) as Buffer
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuf, iv)
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    tag: bufferToBase64(tag),
    data: bufferToBase64(ct),
  }
}

async function decryptString(obj: any, passphrase: string) {
  const c = await getCrypto()
  const salt = base64ToBuffer(obj.salt)
  const iv = base64ToBuffer(obj.iv)

  if ((c as any).subtle) {
    const key = await deriveKeyFromPassphrase(passphrase, salt)
    const cipherBuf = base64ToBuffer(obj.data)
    const plainBuf = await (c as any).subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipherBuf,
    )
    const dec = new TextDecoder()
    return dec.decode(plainBuf)
  }

  const crypto = await import("crypto")
  const keyBuf = (await deriveKeyFromPassphrase(passphrase, salt)) as Buffer
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuf, iv)
  if (obj.tag) decipher.setAuthTag(base64ToBuffer(obj.tag))
  const pt = Buffer.concat([
    decipher.update(base64ToBuffer(obj.data)),
    decipher.final(),
  ])
  return pt.toString("utf8")
}

function cryptoRandom(len: number): Uint8Array {
  if (typeof crypto !== "undefined" && (crypto as any).getRandomValues) {
    const a = new Uint8Array(len)
    ;(crypto as any).getRandomValues(a)
    return a
  }
  // Node fallback
  const b = Buffer.from((require("crypto") as any).randomBytes(len))
  return new Uint8Array(b)
}

function bufferToBase64(buf: Uint8Array | Buffer) {
  if (typeof Buffer !== "undefined" && buf instanceof Buffer)
    return buf.toString("base64")
  return Buffer.from(buf).toString("base64")
}

function base64ToBuffer(s: string): Uint8Array {
  if (typeof Buffer !== "undefined")
    return new Uint8Array(Buffer.from(s, "base64"))
  const bin = atob(s)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}
