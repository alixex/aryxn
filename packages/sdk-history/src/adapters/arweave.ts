import {
  IHistoryAdapter,
  ChainRecord,
  OnRecordCallback,
  FetchOptions,
} from "../types"

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

export class ArweaveAdapter implements IHistoryAdapter {
  private endpoint = "https://arweave.net/graphql"

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

        const type = parseFloat(amount) > 0 ? "SEND" : "UNKNOWN"
        // We could check tags to see if it's a specific app interaction

        const record: ChainRecord = {
          id: node.id,
          chain: "arweave",
          type: type as any,
          status: "COMPLETED", // Arweave txs in gateway are usually confirmed or pending, but GQL returns confirmed typically (mined)
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
}
