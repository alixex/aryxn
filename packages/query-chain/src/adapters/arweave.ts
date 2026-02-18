import {
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
} from "@aryxn/constants"

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
  private endpoint = RPCs.ARWEAVE_GATEWAY

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
      const response = await fetch(this.endpoint, {
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
    const { query, limit = 20, sort = "HEIGHT_DESC" } = options
    const queryTrimmed = query.trim()

    if (!queryTrimmed) return []

    // Basic search strategy: Check if it's a TX ID, or search by app name tag if supported
    // For now, let's implement the generic tag search similar to the original library

    const isTxId = /^[A-Za-z0-9_-]{43}$/.test(queryTrimmed)

    try {
      if (isTxId) {
        // ... (Tx ID lookup logic)
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
        const response = await this.postStore(txQuery)
        if (response.data?.transaction) {
          return [response.data.transaction]
        }
      }

      // General Search (App-Name = Aryxn by default or provided in query?)
      // Since specific logic was "searchAppTransactions", let's make this more generic or ported.
      // We'll search for transactions where ANY tag value matches the query or specific App-Name.
      // Limitations of Arweave GQL: no full text search.

      // Let's implement the "Fetch recent and filter in memory" strategy from the original code

      const fetchLimit = Math.min(100, limit * 20) // Moderate fetch size
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
        variables: { limit: fetchLimit, sort },
      }

      const response = await this.postStore(graphqlQuery)
      const edges = response.data?.transactions?.edges || []
      const transactions = edges.map((e: any) => e.node)

      const queryLower = queryTrimmed.toLowerCase()
      const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 0)

      return transactions
        .filter((tx: SearchResult) => {
          if (tx.id.toLowerCase().includes(queryLower)) return true

          const tagValues = tx.tags.map((t) => t.value.toLowerCase()).join(" ")
          return queryWords.every((word) => tagValues.includes(word))
        })
        .slice(0, limit)
    } catch (error) {
      console.error("[ArweaveAdapter] Search error:", error)
      return []
    }
  }

  private async postStore(body: any): Promise<any> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!response.ok)
      throw new Error(`Arweave API error: ${response.statusText}`)
    return await response.json()
  }
}
