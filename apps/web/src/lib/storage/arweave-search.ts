/**
 * Arweave 搜索功能
 * 优先使用本地数据库搜索，必要时补充网络搜索
 */

import { searchFiles, type FileIndex } from "./file-manager"

export interface ArweaveSearchResult {
  id: string
  owner: {
    address: string
  }
  tags: Array<{
    name: string
    value: string
  }>
  block: {
    height: number
    timestamp: number
  }
  data: {
    size: string
  }
}

export interface SearchOptions {
  query: string
  limit?: number
  sort?: "HEIGHT_DESC" | "HEIGHT_ASC"
  ownerAddress?: string // 用于本地搜索的账户地址
  preferLocal?: boolean // 是否优先本地搜索（默认 true）
}

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

/**
 * 在 Arweave 网络上搜索交易（纯网络搜索，不涉及本地数据库）
 * 通过标签值进行模糊搜索
 * 注意：Arweave GraphQL API 不支持全文搜索和通配符，我们使用多种策略来提高搜索命中率
 */
async function searchArweaveTransactionsNetwork(
  options: Omit<SearchOptions, "ownerAddress" | "preferLocal">,
): Promise<ArweaveSearchResult[]> {
  const { query, limit = 20, sort = "HEIGHT_DESC" } = options

  if (!query.trim()) {
    return []
  }

  const queryTrimmed = query.trim()
  const queryLower = queryTrimmed.toLowerCase()

  // 检查是否是交易ID格式（43个字符的base64url字符串）
  const isTxId = /^[A-Za-z0-9_-]{43}$/.test(queryTrimmed)

  try {
    // 策略1: 如果是交易ID，直接查询该交易
    if (isTxId) {
      try {
        const txQuery = {
          query: `
            query GetTransaction($id: ID!) {
              transaction(id: $id) {
                id
                owner {
                  address
                }
                tags {
                  name
                  value
                }
                block {
                  height
                  timestamp
                }
                data {
                  size
                }
              }
            }
          `,
          variables: {
            id: queryTrimmed,
          },
        }

        const response = await fetch("https://arweave.net/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(txQuery),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.data?.transaction && !result.errors) {
            console.log("Found transaction by ID:", result.data.transaction.id)
            return [result.data.transaction]
          }
        }
      } catch (error) {
        // 如果直接查询失败，继续使用其他策略
        console.warn("Direct transaction query failed:", error)
      }
    }

    // 策略2: 优先搜索 Aryxn 应用的文件（用户更可能搜索自己上传的文件）
    try {
      const appResults = await searchAppTransactions(
        "Aryxn",
        queryTrimmed,
        Math.max(limit * 2, 100),
      )
      if (appResults.length > 0) {
        console.log(`Found ${appResults.length} results in Aryxn app`)
        return appResults.slice(0, limit)
      }
    } catch (error) {
      console.warn("Search in Aryxn app failed:", error)
    }

    // 策略3: 如果应用内搜索没有结果，搜索所有最近的交易
    const fetchLimit = Math.min(10000, limit * 500) // 大幅增加获取数量以提高命中率

    const graphqlQuery = {
      query: `
        query SearchTransactions($limit: Int!, $sort: SortOrder!) {
          transactions(
            sort: $sort
            first: $limit
          ) {
            edges {
              node {
                id
                owner {
                  address
                }
                tags {
                  name
                  value
                }
                block {
                  height
                  timestamp
                }
                data {
                  size
                }
              }
            }
          }
        }
      `,
      variables: {
        limit: fetchLimit,
        sort,
      },
    }

    const response = await fetch("https://arweave.net/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphqlQuery),
    })

    if (!response.ok) {
      throw new Error(`GraphQL query failed: ${response.status}`)
    }

    const result = await response.json()

    if (result.errors) {
      console.error("GraphQL errors:", result.errors)
      throw new Error(`GraphQL query failed: ${result.errors[0]?.message}`)
    }

    const transactions = result.data?.transactions?.edges || []

    console.log(
      `Fetched ${transactions.length} recent transactions for filtering`,
    )

    if (transactions.length === 0) {
      return []
    }

    // 过滤结果：检查标签值是否包含查询关键词（不区分大小写）
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 0)

    const filteredTransactions = transactions
      .map((edge: { node: ArweaveSearchResult }) => edge.node)
      .filter((tx: ArweaveSearchResult) => {
        // 检查交易 ID 是否匹配
        if (tx.id.toLowerCase().includes(queryLower)) {
          return true
        }

        // 检查标签值是否包含查询关键词
        // 支持多词搜索（所有词都必须匹配）
        const tagValues = tx.tags
          .map((tag) => tag.value.toLowerCase())
          .join(" ")
        return queryWords.every((word) => tagValues.includes(word))
      })
      .slice(0, limit) // 限制返回结果数量

    console.log(
      `Filtered to ${filteredTransactions.length} matching transactions`,
    )
    return filteredTransactions
  } catch (error) {
    console.error("Failed to search Arweave transactions:", error)
    throw error
  }
}

/**
 * 搜索特定应用名称的交易
 */
export async function searchAppTransactions(
  appName: string,
  query: string,
  limit: number = 50,
): Promise<ArweaveSearchResult[]> {
  if (!query.trim()) {
    return []
  }

  try {
    const graphqlQuery = {
      query: `
        query SearchAppTransactions($appName: String!, $limit: Int!) {
          transactions(
            tags: [
              { name: "App-Name", values: [$appName] }
            ]
            sort: HEIGHT_DESC
            first: $limit
          ) {
            edges {
              node {
                id
                owner {
                  address
                }
                tags {
                  name
                  value
                }
                block {
                  height
                  timestamp
                }
                data {
                  size
                }
              }
            }
          }
        }
      `,
      variables: {
        appName,
        limit,
      },
    }

    const response = await fetch("https://arweave.net/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphqlQuery),
    })

    if (!response.ok) {
      throw new Error(`GraphQL query failed: ${response.status}`)
    }

    const result = await response.json()

    if (result.errors) {
      console.error("GraphQL errors:", result.errors)
      throw new Error(`GraphQL query failed: ${result.errors[0]?.message}`)
    }

    const transactions = result.data?.transactions?.edges || []

    // 过滤结果：检查标签值是否包含查询关键词
    const queryLower = query.toLowerCase()
    const filteredTransactions = transactions
      .map((edge: { node: ArweaveSearchResult }) => edge.node)
      .filter((tx: ArweaveSearchResult) => {
        // 检查交易 ID 是否匹配
        if (tx.id.toLowerCase().includes(queryLower)) {
          return true
        }

        // 检查标签值是否包含查询关键词
        return tx.tags.some((tag) =>
          tag.value.toLowerCase().includes(queryLower),
        )
      })

    return filteredTransactions
  } catch (error) {
    console.error("Failed to search app transactions:", error)
    throw error
  }
}
