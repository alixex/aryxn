/**
 * Arweave 网络搜索功能
 * 提供通用的 Arweave GraphQL 搜索能力
 */

import { getSearchCache } from "./search-cache"

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
  cache?: boolean // 是否使用缓存（默认 true）
  cacheTtl?: number // 缓存生存时间（毫秒）
}

/**
 * 在 Arweave 网络上搜索交易（纯网络搜索）
 * 通过标签值进行模糊搜索
 * 注意：Arweave GraphQL API 不支持全文搜索和通配符，我们使用多种策略来提高搜索命中率
 */
export async function searchArweaveTransactionsNetwork(
  options: SearchOptions,
): Promise<ArweaveSearchResult[]> {
  const {
    query,
    limit = 20,
    sort = "HEIGHT_DESC",
    cache = true,
    cacheTtl,
  } = options

  if (!query.trim()) {
    return []
  }

  // 检查缓存
  if (cache) {
    const searchCache = getSearchCache()
    const cacheKey = searchCache.generateKey({ query, limit, sort })
    const cachedResults = searchCache.get<ArweaveSearchResult[]>(cacheKey)

    if (cachedResults !== null) {
      console.log(`Search cache hit for query: "${query}"`)
      return cachedResults
    }

    // 执行搜索并缓存结果
    const results = await performSearch(query, limit, sort)
    searchCache.set(cacheKey, results, cacheTtl)
    return results
  }

  // 不使用缓存，直接搜索
  return performSearch(query, limit, sort)
}

/**
 * 执行实际的搜索逻辑
 */
async function performSearch(
  query: string,
  limit: number,
  sort: "HEIGHT_DESC" | "HEIGHT_ASC",
): Promise<ArweaveSearchResult[]> {
  const queryTrimmed = query.trim()
  const queryLower = queryTrimmed.toLowerCase()

  // 检查是否是交易 ID 格式（43 个字符的 base64url 字符串）
  const isTxId = /^[A-Za-z0-9_-]{43}$/.test(queryTrimmed)

  try {
    // 策略 1: 如果是交易 ID，直接查询该交易
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

    // 策略 2: 优先搜索 Aryxn 应用的文件（用户更可能搜索自己上传的文件）
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

    // 策略 3: 如果应用内搜索没有结果，搜索所有最近的交易
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
  cache: boolean = true,
  cacheTtl?: number,
): Promise<ArweaveSearchResult[]> {
  if (!query.trim()) {
    return []
  }

  // 检查缓存
  if (cache) {
    const searchCache = getSearchCache()
    const cacheKey = searchCache.generateKey({ appName, query, limit })
    const cachedResults = searchCache.get<ArweaveSearchResult[]>(cacheKey)

    if (cachedResults !== null) {
      console.log(`Search cache hit for app: "${appName}", query: "${query}"`)
      return cachedResults
    }

    // 执行搜索并缓存结果
    const results = await performAppSearch(appName, query, limit)
    searchCache.set(cacheKey, results, cacheTtl)
    return results
  }

  // 不使用缓存，直接搜索
  return performAppSearch(appName, query, limit)
}

/**
 * 执行实际的应用搜索逻辑
 */
async function performAppSearch(
  appName: string,
  query: string,
  limit: number,
): Promise<ArweaveSearchResult[]> {
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
