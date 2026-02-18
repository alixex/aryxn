import {
  IHistoryAdapter,
  ChainRecord,
  OnRecordCallback,
  FetchOptions,
} from "../types"

interface BlockscoutTx {
  hash: string
  from: { hash: string }
  to: { hash: string }
  value: string // wei
  timestamp: string // ISO date
  status: "ok" | "error"
  fee: { value: string }
  token_transfers?: {
    from: { hash: string }
    to: { hash: string }
    total: { value: string; decimals: string }
    token: { symbol: string }
    type: string
  }[]
}

interface BlockscoutResponse {
  items: BlockscoutTx[]
  next_page_params?: any
}

/**
 * EVM Adapter using public Blockscout V2 API.
 */
export class EVMAdapter implements IHistoryAdapter {
  private apiUrl: string = "https://eth.blockscout.com/api/v2"

  constructor(_rpcUrl?: string) {
    // rpcUrl ignored for now, utilizing standard blockscout api
  }

  async fetchRecords(
    address: string,
    onRecord: OnRecordCallback,
    _options?: FetchOptions,
  ): Promise<void> {
    try {
      const url = `${this.apiUrl}/addresses/${address}/transactions`
      const response = await fetch(url)

      if (!response.ok) {
        console.warn(`[EVMAdapter] Failed to fetch. Status: ${response.status}`)
        return
      }

      const data: BlockscoutResponse = await response.json()

      for (const tx of data.items) {
        // Basic ETH transfer logic
        // For tokens, Blockscout v2 provides `token_transfers` but it's often separate endpoint
        // This basic implementation focuses on native ETH txs and top-level listing.

        const isOk = tx.status === "ok"
        const isSend = tx.from.hash.toLowerCase() === address.toLowerCase()

        let type = "UNKNOWN"
        if (isSend) type = "SEND"
        if (!isSend && tx.to?.hash.toLowerCase() === address.toLowerCase())
          type = "RECEIVE"

        // Check value
        // If value is 0, might be a token transfer.
        // Blockscout returns `value` in string wei.

        let amount = tx.value
        let token = "ETH"

        // Simple heuristic: if value is 0, check for token transfers (if available in this endpoint response scope)
        // Usually /transactions includes token transfers in `token_transfers` field sometimes, or needs separate call.
        // For MVP: assume Native ETH.

        // Conversion from Wei
        const ethVal = (BigInt(amount) / 1000000000000000000n).toString() // Simplified integer div
        // Better formatting needed but sticking to string for safety.
        // Showing raw huge numbers or just 0 if < 1 ETH is risky.
        // Let's us a simple float cast for display history:
        const ethFloat = parseFloat(amount) / 1e18

        const record: ChainRecord = {
          id: tx.hash,
          chain: "ethereum",
          type: type as any,
          status: isOk ? "COMPLETED" : "FAILED",
          from: tx.from.hash,
          to: tx.to?.hash || "",
          amount: ethFloat.toFixed(6), // Display friendly
          token: token,
          timestamp: new Date(tx.timestamp).getTime(),
          fee: tx.fee?.value,
        }

        onRecord(record)
      }
    } catch (error) {
      console.error("[EVMAdapter] Error fetching history:", error)
    }
  }

  isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }
}
