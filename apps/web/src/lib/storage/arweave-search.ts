/**
 * Arweave 搜索功能 - 混合本地与网络搜索
 * 优先使用本地数据库搜索，必要时补充网络搜索
 */

import {
  searchArweaveTransactionsNetwork,
  searchAppTransactions,
  type ArweaveSearchResult,
  type SearchOptions as BaseSearchOptions,
} from "@aryxn/arweave"
import { searchFiles, type FileIndex } from "./file-manager"

// 扩展基础搜索选项，添加本地搜索特定选项
export interface SearchOptions extends BaseSearchOptions {
  ownerAddress?: string // 用于本地搜索的账户地址
  preferLocal?: boolean // 是否优先本地搜索（默认 true）
}

// 重新导出类型
export type { ArweaveSearchResult }

/**
 * 将本地文件索引转换为 Arweave 搜索结果格式
 */
function convertFileIndexToSearchResult(file: FileIndex): ArweaveSearchResult {
  // 从文件信息构建标签数组
  const tags: Array<{ name: string; value: string }> = [
    { name: "App-Name", value: "Aryxn" },
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
    file.tags.forEach((tag) => {
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
 * 混合搜索：优先本地搜索，必要时补充网络搜索
 *
 * 搜索策略：
 * 1. 优先在本地数据库中搜索（如果提供了 ownerAddress）
 * 2. 如果本地搜索结果不足或没有结果，且满足以下条件之一，则进行网络搜索：
 *    - 查询的是交易ID（43字符）
 *    - 本地搜索结果数量少于 limit
 *    - 用户明确需要搜索网络上的所有文件（包括其他用户的文件）
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

  // 检查是否是交易ID格式（43个字符的base64url字符串）
  const isTxId = /^[A-Za-z0-9_-]{43}$/.test(queryTrimmed)

  // 策略1: 优先本地搜索（如果提供了 ownerAddress 且 preferLocal 为 true）
  if (preferLocal && ownerAddress) {
    try {
      const localFiles = await searchFiles(ownerAddress, {
        query: queryTrimmed,
        limit: limit * 2, // 获取更多结果以便去重
      })

      localResults.push(...localFiles.map(convertFileIndexToSearchResult))

      console.log(`Found ${localResults.length} results in local database`)

      // 如果查询的是交易ID，且本地找到了，直接返回
      if (isTxId && localResults.length > 0) {
        return localResults.slice(0, limit)
      }

      // 如果本地结果已经足够，直接返回
      if (localResults.length >= limit) {
        return localResults.slice(0, limit)
      }
    } catch (error) {
      console.warn("Local search failed:", error)
      // 本地搜索失败，继续网络搜索
    }
  }

  // 策略2: 网络搜索（在以下情况下进行）
  // - 查询的是交易ID（可能不在本地数据库中）
  // - 本地搜索结果不足
  // - 需要搜索其他用户的文件
  const needsNetworkSearch =
    isTxId || // 交易ID查询总是需要网络搜索
    localResults.length < limit || // 本地结果不足
    !preferLocal || // 用户明确要求网络搜索
    !ownerAddress // 没有提供账户地址，无法本地搜索

  if (needsNetworkSearch) {
    try {
      const networkResults = await searchArweaveTransactionsNetwork({
        query: queryTrimmed,
        limit: limit * 2, // 获取更多结果以便去重和合并
        sort,
      })

      // 合并结果：优先本地结果，然后补充网络结果
      const localTxIds = new Set(localResults.map((r) => r.id))
      const uniqueNetworkResults = networkResults.filter(
        (r) => !localTxIds.has(r.id),
      )

      results.push(...localResults)
      results.push(...uniqueNetworkResults)

      console.log(
        `Combined search: ${localResults.length} local + ${uniqueNetworkResults.length} network = ${results.length} total`,
      )

      return results.slice(0, limit)
    } catch (error) {
      console.error("Network search failed:", error)
      // 网络搜索失败，返回本地结果（如果有）
      if (localResults.length > 0) {
        return localResults.slice(0, limit)
      }
      throw error
    }
  }

  // 如果不需要网络搜索，直接返回本地结果
  return localResults.slice(0, limit)
}

// 重新导出网络搜索函数以支持不需要本地数据的场景
export { searchAppTransactions }
