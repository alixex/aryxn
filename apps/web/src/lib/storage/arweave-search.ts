/**
 * Arweave 搜索功能 - 混合本地与网络搜索
 * 优先使用本地数据库搜索，必要时补充网络搜索
 */

import {
  ArweaveAdapter,
  type SearchResult as ArweaveSearchResult,
  type SearchOptions as BaseSearchOptions,
} from "@aryxn/query-chain"
import {
  searchFiles,
  type FileIndex,
  downloadManifest,
  type FileManifest,
} from "@/lib/file"
import { ARWEAVE_APP_NAME } from "@/lib/config"

// 扩展基础搜索选项，添加本地搜索特定选项
export interface SearchOptions extends BaseSearchOptions {
  ownerAddress?: string // 用于本地搜索的账户地址
  preferLocal?: boolean // 是否优先本地搜索（默认 true）
  cache?: boolean // Ignored in query-chain for now
  cacheTtl?: number // Ignored in query-chain for now
}

const arweaveAdapter = new ArweaveAdapter()

// 重新导出类型
export type { ArweaveSearchResult }

/**
 * 将本地文件索引转换为 Arweave 搜索结果格式
 */
function convertFileIndexToSearchResult(file: FileIndex): ArweaveSearchResult {
  // 从文件信息构建标签数组
  const tags: Array<{ name: string; value: string }> = [
    { name: "App-Name", value: ARWEAVE_APP_NAME },
    { name: "Owner-Address", value: file.owner_address },
    { name: "File-Name", value: file.file_name },
    { name: "Content-Type", value: file.mime_type },
  ]

  if (file.description) {
    tags.push({ name: "Description", value: file.description })
  }

  if (file.encryption_algo && file.encryption_algo !== "none") {
    tags.push({ name: "Encryption-Algo", value: file.encryption_algo })
    tags.push({
      name: "Encryption-Params",
      value: file.encryption_params || "{}",
    })
  }

  if (file.tags && file.tags.length > 0) {
    file.tags.forEach((tag: string) => {
      tags.push({ name: "Tag", value: tag })
    })
  }

  return {
    id: file.tx_id,
    owner: {
      address: file.owner_address,
    },
    tags,
    block: {
      height: 0, // 本地数据库可能没有区块高度信息
      timestamp: Math.floor(file.created_at / 1000), // 转换为秒
    },
    data: {
      size: String(file.file_size),
    },
  }
}

/**
 * 在清单文件中搜索文件
 * 支持文件名、描述、存储 ID 和标签的搜索
 */
function searchInManifest(
  manifest: FileManifest,
  query: string,
  limit: number = 20,
): FileIndex[] {
  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 0)

  const results = manifest.files
    .filter((file) => {
      // 搜索文件名
      if (file.file_name.toLowerCase().includes(queryLower)) {
        return true
      }

      // 搜索描述
      if (file.description?.toLowerCase().includes(queryLower)) {
        return true
      }

      // 搜索存储 ID
      if (file.tx_id.toLowerCase().includes(queryLower)) {
        return true
      }

      // 搜索标签
      if (file.tags?.some((tag) => tag.toLowerCase().includes(queryLower))) {
        return true
      }

      // 搜索多个关键词（使用 AND 逻辑）
      const fileText =
        `${file.file_name} ${file.description || ""} ${file.tags?.join(" ") || ""}`.toLowerCase()
      return queryWords.every((word) => fileText.includes(word))
    })
    .slice(0, limit)

  return results as FileIndex[]
}

/**
 * 混合搜索：优先本地搜索 → 清单搜索 → 网络搜索
 *
 * 搜索策略：
 * 1. 优先在本地数据库中搜索（如果提供了 ownerAddress）
 * 2. 如果本地搜索结果不足，尝试清单文件搜索（获取所有历史文件）
 * 3. 如果清单结果仍不足，进行网络搜索（查询 Arweave 网络）
 *
 * 搜索层级流程：
 * 本地 DB (毫秒级) → 清单文件 (快速) → 网络搜索 (秒级)
 *
 * @param options 搜索选项
 * @returns 搜索结果数组
 */
export async function searchArweaveTransactions(
  options: SearchOptions,
): Promise<ArweaveSearchResult[]> {
  const {
    query,
    limit = 20,
    sort = "HEIGHT_DESC",
    ownerAddress,
    preferLocal = true,
  } = options

  if (!query.trim()) {
    return []
  }

  const queryTrimmed = query.trim()
  const results: ArweaveSearchResult[] = []
  const localResults: ArweaveSearchResult[] = []
  const resultTxIds = new Set<string>()

  // 检查是否是存储 ID 格式（43 个字符的 base64url 字符串）
  const isTxId = /^[A-Za-z0-9_-]{43}$/.test(queryTrimmed)

  // 策略 1: 优先本地搜索（如果提供了 ownerAddress 且 preferLocal 为 true）
  if (preferLocal && ownerAddress) {
    try {
      const localFiles = await searchFiles(ownerAddress, {
        query: queryTrimmed,
        limit: limit * 2, // 获取更多结果以便去重
      })

      localResults.push(...localFiles.map(convertFileIndexToSearchResult))
      localFiles.forEach((file) => resultTxIds.add(file.tx_id))

      console.log(`Found ${localResults.length} results in local database`)

      // 如果查询的是存储 ID，且本地找到了，直接返回
      if (isTxId && localResults.length > 0) {
        return localResults.slice(0, limit)
      }

      // 如果本地结果已经足够，直接返回
      if (localResults.length >= limit) {
        return localResults.slice(0, limit)
      }
    } catch (error) {
      console.warn("Local search failed:", error)
      // 本地搜索失败，继续进行下一步搜索
    }
  }

  // 策略 2: 清单文件搜索（如果本地结果不足）
  // 清单包含所有历史文件，不受 10000 条交易限制
  if (ownerAddress && localResults.length < limit) {
    try {
      console.log(
        `Local search returned ${localResults.length} results, fetching manifest...`,
      )

      const manifest = await downloadManifest(ownerAddress)
      if (manifest) {
        const manifestFiles = searchInManifest(
          manifest,
          queryTrimmed,
          limit * 2,
        )

        // 过滤掉已经在本地结果中的文件
        const uniqueManifestFiles = manifestFiles.filter(
          (file) => !resultTxIds.has(file.tx_id),
        )

        const manifestResults = uniqueManifestFiles.map(
          convertFileIndexToSearchResult,
        )
        localResults.push(...manifestResults)
        uniqueManifestFiles.forEach((file) => resultTxIds.add(file.tx_id))

        console.log(
          `Found ${manifestResults.length} additional results in manifest`,
        )

        // 如果通过清单获得了足够的结果
        if (localResults.length >= limit) {
          return localResults.slice(0, limit)
        }
      }
    } catch (error) {
      console.warn("Manifest search failed:", error)
      // 清单搜索失败，继续网络搜索
    }
  }

  // 策略 3: 网络搜索（在以下情况下进行）
  // - 查询的是存储 ID（可能不在本地数据库和清单中）
  // - 本地和清单搜索结果仍不足
  // - 需要搜索其他用户的文件
  const needsNetworkSearch =
    isTxId || // 存储 ID 查询总是需要网络搜索
    localResults.length < limit || // 搜索结果仍不足
    !preferLocal || // 用户明确要求网络搜索
    !ownerAddress // 没有提供账户地址，无法本地搜索

  if (needsNetworkSearch) {
    try {
      console.log(
        `Insufficient results (${localResults.length}/${limit}), performing network search...`,
      )

      const networkResults = await arweaveAdapter.search({
        query: queryTrimmed,
        limit: Math.max(limit * 2, 50), // 获取足够的结果以便去重和合并
        sort,
      })

      // 过滤掉已经有的结果，避免重复
      const uniqueNetworkResults = networkResults.filter(
        (r) => !resultTxIds.has(r.id),
      )

      console.log(
        `Network search returned ${uniqueNetworkResults.length} unique results`,
      )

      results.push(...localResults)
      results.push(...uniqueNetworkResults)

      console.log(
        `Combined search: ${localResults.length} local+manifest + ${uniqueNetworkResults.length} network = ${results.length} total`,
      )

      return results.slice(0, limit)
    } catch (error) {
      console.error("Network search failed:", error)
      // 网络搜索失败，返回已有结果
      if (localResults.length > 0) {
        return localResults.slice(0, limit)
      }
      throw error
    }
  }

  // 如果不需要网络搜索，直接返回本地和清单结果
  return localResults.slice(0, limit)
}

// 重新导出网络搜索函数以支持不需要本地数据的场景
export async function searchAppTransactions(
  appName: string,
  query: string,
  limit: number = 50,
) {
  return arweaveAdapter.searchAppTransactions(appName, query, limit)
}

// 导出清单搜索函数以供其他模块使用
export { searchInManifest }
