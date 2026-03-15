import type {
  IHistoryAdapter,
  ChainRecord,
  OnRecordCallback,
  FetchOptions,
  SearchOptions,
  SearchResult,
  ISearchAdapter,
} from "../types"
import {
  Chains,
  TransactionTypes,
  TransactionStatuses,
  RPCs,
} from "@aryxn/chain-constants"

interface ArweaveEdge {
  node: {
    id: string
    owner: { address: string }
    recipient: string
    quantity: { ar: string }
    block: { timestamp: number }
    tags: { name: string; value: string }[]
  }
}

interface ArweaveResponse {
  data: {
    transactions: {
      edges: ArweaveEdge[]
    }
  }
}

export class ArweaveAdapter implements IHistoryAdapter, ISearchAdapter {
  private arweaveEndpoint = RPCs.ARWEAVE_GATEWAY
  private irysEndpoint = `${RPCs.IRYS_NODE}/graphql`

  async fetchRecords(
    address: string,
    onRecord: OnRecordCallback,
    options?: FetchOptions,
  ): Promise<void> {
    const query = `
      query {
        transactions(
          owners: ["${address}"]
          first: ${options?.limit || 20}
        ) {
          edges {
            node {
              id
              owner { address }
              recipient
              quantity { ar }
              block { timestamp }
              tags { name value }
            }
          }
        }
      }
    `

    try {
      const response = await fetch(this.arweaveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })

      if (!response.ok) {
        throw new Error(`Arweave API error: ${response.statusText}`)
      }

      const result: ArweaveResponse = await response.json()
      const edges = result.data.transactions.edges

      for (const edge of edges) {
        const node = edge.node
        const amount = node.quantity.ar

        // Skip 0 value data transactions if we only want payments,
        // but often data txs are important too. Let's keep them but mark type.
        // For DEX history, we usually care about value transfers.
        // Let's assume > 0 is a transfer, 0 might be upload.

        const type =
          parseFloat(amount) > 0
            ? TransactionTypes.SEND
            : TransactionTypes.UNKNOWN
        // We could check tags to see if it's a specific app interaction

        const record: ChainRecord = {
          id: node.id,
          chain: Chains.ARWEAVE,
          type: type,
          status: TransactionStatuses.COMPLETED, // Arweave txs in gateway are usually confirmed or pending, but GQL returns confirmed typically (mined)
          from: node.owner.address,
          to: node.recipient || "Data Upload",
          amount: amount,
          token: "AR",
          timestamp: node.block ? node.block.timestamp * 1000 : Date.now(),
        }

        onRecord(record)
      }
    } catch (error) {
      console.error("[ArweaveAdapter] Error fetching history:", error)
    }
  }

  isValidAddress(address: string): boolean {
    // Arweave addresses are 43 chars base64url
    return /^[a-zA-Z0-9_-]{43}$/.test(address)
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const {
      query,
      limit = 20,
      sort = "HEIGHT_DESC",
      appName = "Aryxn",
    } = options
    const queryTrimmed = query.trim()

    if (!queryTrimmed) return []

    // Basic search strategy: Check if it's a TX ID, or search by app name tag if supported
    // For now, let's implement the generic tag search similar to the original library

    const isTxId = /^[A-Za-z0-9_-]{43}$/.test(queryTrimmed)

    try {
      // Strategy 1: Direct Transaction ID lookup (Check Arweave, then Irys if not found)
      if (isTxId) {
        try {
          const txQuery = {
            query: `
              query GetTransaction($id: ID!) {
                transaction(id: $id) {
                  id
                  owner { address }
                  tags { name value }
                  block { height timestamp }
                  data { size }
                }
              }
            `,
            variables: { id: queryTrimmed },
          }
          let txFound = false
          // Try Arweave first
          try {
            const response = await this.postStore(this.arweaveEndpoint, txQuery)
            if (response.data?.transaction) {
              console.log(
                "[ArweaveAdapter] Found transaction on Arweave:",
                response.data.transaction.id,
              )
              return [this.mapToSearchResult(response.data.transaction)]
            }
          } catch (e) {
            console.warn("[ArweaveAdapter] Arweave search error:", e)
            /* ignore */
          }

          // Try Irys if not found
          if (!txFound) {
            try {
              const response = await this.postStore(this.irysEndpoint, txQuery)
              if (response.data?.transaction) {
                console.log(
                  "[ArweaveAdapter] Found transaction on IrysL1:",
                  response.data.transaction.id,
                )
                return [this.mapToSearchResult(response.data.transaction)]
              }
            } catch (e) {
              console.warn("[ArweaveAdapter] IrysL1 search error:", e)
              /* ignore */
            }
          }
        } catch (e) {
          console.warn("[ArweaveAdapter] Direct transaction query failed:", e)
        }
      }

      // Strategy 2: Search within App-Name (Prioritized)
      try {
        const appResults = await this.searchAppTransactions(
          appName,
          queryTrimmed,
          Math.max(limit * 2, 100),
          options.networkFilter || "all",
        )
        if (appResults.length > 0) {
          console.log(
            `[ArweaveAdapter] Found ${appResults.length} results in app: ${appName}`,
          )
          return appResults.slice(0, limit)
        }
      } catch (e) {
        console.warn("[ArweaveAdapter] Search in app failed:", e)
      }

      // Strategy 3: Deep search (Fetch recent & filter in memory across BOTH networks)
      const fetchLimit = Math.min(10000, limit * 500) // Deep fetch
      console.log(
        `[ArweaveAdapter] Performing deep search with limit: ${fetchLimit} on Arweave and Irys L1`,
      )

      const graphqlQuery = {
        query: `
          query SearchTransactions($limit: Int!, $sort: SortOrder!) {
            transactions(sort: $sort, first: $limit) {
              edges {
                node {
                  id
                  owner { address }
                  tags { name value }
                  block { height timestamp }
                  data { size }
                }
              }
            }
          }
        `,
        variables: { limit: fetchLimit / 2, sort }, // Split limit between networks
      }

      // Federated Fetching
      const { networkFilter = "all" } = options
      const [arweaveResponse, irysResponse] = await Promise.all([
        networkFilter === "irys"
          ? Promise.resolve({ data: { transactions: { edges: [] } } })
          : this.postStore(this.arweaveEndpoint, graphqlQuery).catch(() => ({
              data: { transactions: { edges: [] } },
            })),
        networkFilter === "arweave"
          ? Promise.resolve({ data: { transactions: { edges: [] } } })
          : this.postStore(this.irysEndpoint, graphqlQuery).catch(() => ({
              data: { transactions: { edges: [] } },
            })),
      ])

      const arweaveEdges = arweaveResponse.data?.transactions?.edges || []
      const irysEdges = irysResponse.data?.transactions?.edges || []
      const allEdges = [...arweaveEdges, ...irysEdges]

      const transactions = allEdges.map((e: any) => e.node)

      console.log(
        `[ArweaveAdapter] Fetched ${transactions.length} recent transactions for filtering (${arweaveEdges.length} AR, ${irysEdges.length} IRYS)`,
      )

      const queryLower = queryTrimmed.toLowerCase()
      const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 0)

      const filtered = transactions
        .map((tx: any) => this.mapToSearchResult(tx))
        .filter((tx: SearchResult) => {
          if (tx.id.toLowerCase().includes(queryLower)) return true

          const tagValues = tx.tags.map((t) => t.value.toLowerCase()).join(" ")
          return queryWords.every((word) => tagValues.includes(word))
        })

      console.log(
        `[ArweaveAdapter] Filtered to ${filtered.length} matching transactions`,
      )

      return filtered.slice(0, limit)
    } catch (error) {
      console.error("[ArweaveAdapter] Search error:", error)
      return []
    }
  }

  async searchAppTransactions(
    appName: string,
    query: string,
    limit: number,
    networkFilter: "all" | "irys" | "arweave" = "all",
  ): Promise<SearchResult[]> {
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
                owner { address }
                tags { name value }
                block { height timestamp }
                data { size }
              }
            }
          }
        }
      `,
      variables: { appName, limit },
    }

    // Federated Fetching
    const [arweaveResponse, irysResponse] = await Promise.all([
      networkFilter === "irys"
        ? Promise.resolve({ data: { transactions: { edges: [] } } })
        : this.postStore(this.arweaveEndpoint, graphqlQuery).catch(() => ({
            data: { transactions: { edges: [] } },
          })),
      networkFilter === "arweave"
        ? Promise.resolve({ data: { transactions: { edges: [] } } })
        : this.postStore(this.irysEndpoint, graphqlQuery).catch(() => ({
            data: { transactions: { edges: [] } },
          })),
    ])

    const arweaveEdges = arweaveResponse.data?.transactions?.edges || []
    const irysEdges = irysResponse.data?.transactions?.edges || []

    // Merge, map to search result, sort by timestamp
    const allEdges = [...arweaveEdges, ...irysEdges]

    const queryLower = query.toLowerCase()

    const results = allEdges
      .map((e: any) => e.node)
      .map((tx: any) => this.mapToSearchResult(tx))
      .filter((tx: SearchResult) => {
        if (tx.id.toLowerCase().includes(queryLower)) return true
        const tagValues = tx.tags.map((t) => t.value.toLowerCase()).join(" ")
        return tagValues.includes(queryLower)
      })

    // Sort combined results by timestamp descending
    return results.sort((a, b) => b.block.timestamp - a.block.timestamp)
  }

  private mapToSearchResult(node: any): SearchResult {
    return {
      id: node.id,
      owner: {
        address: node.owner.address,
      },
      tags: node.tags || [],
      block: {
        height: node.block?.height || 0,
        timestamp: node.block?.timestamp || Math.floor(Date.now() / 1000),
      },
      data: {
        size: node.data?.size || "0",
      },
    }
  }

  private async postStore(endpoint: string, body: any): Promise<any> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!response.ok)
      throw new Error(
        `GraphQL API error at ${endpoint}: ${response.statusText}`,
      )
    return await response.json()
  }
}
