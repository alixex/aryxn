import type {
  IHistoryAdapter,
  OnRecordCallback,
  FetchOptions,
  ChainRecord,
} from "../types"
import type { TransactionType } from "@aryxn/chain-constants"
import {
  Chains,
  TransactionTypes,
  TransactionStatuses,
  RPCs,
} from "@aryxn/chain-constants"

interface SolanaSignature {
  signature: string
  slot: number
  err: any
  memo: string | null
  blockTime: number | null
}

interface SolanaTxDetails {
  meta: {
    err: any
    fee: number
    preBalances: number[]
    postBalances: number[]
  }
  transaction: {
    message: {
      accountKeys: { pubkey: string; signer: boolean; writable: boolean }[]
    }
  }
}

export class SolanaAdapter implements IHistoryAdapter {
  private endpoint = RPCs.SOLANA_MAINNET

  async fetchRecords(
    address: string,
    onRecord: OnRecordCallback,
    options?: FetchOptions,
  ): Promise<void> {
    try {
      // 1. Get Signatures
      const signatures = await this.rpcCall<SolanaSignature[]>(
        "getSignaturesForAddress",
        [address, { limit: options?.limit || 10 }],
      )

      if (!signatures || !Array.isArray(signatures)) return

      // 2. Process each signature
      for (const sig of signatures) {
        // Optimization: For a simple history list, we might skip full details if we just want to show "Recent Activity"
        // But to show "Sent 1.5 SOL", we need details.

        // Let's fetch details for the first few or all, depending on performance.
        // Since this is "incremental", fetching one by one is O(N) calls but acceptable for idle background sync.

        try {
          const tx = await this.rpcCall<SolanaTxDetails>("getTransaction", [
            sig.signature,
            { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
          ])

          if (!tx) continue

          // Calculate SOL change for this address
          // We need to find the index of the address in accountKeys (or static account keys in legacy)
          // Simplified for standard transfers:

          // In 'jsonParsed', accountKeys is often an array of objects.
          // We need to match address to index.
          // Note: actual structure depends on 'encoding'. keys might be objects.
          // Keeping it robust with optional chaining or simplified assumption for this MVP.

          const accountKeys = Array.isArray(tx.transaction.message.accountKeys)
            ? tx.transaction.message.accountKeys.map((k: any) => k.pubkey || k) // handle object or string
            : []

          const index = accountKeys.findIndex((k) => k === address)

          let amount = "0"
          let type: TransactionType = TransactionTypes.UNKNOWN

          if (index !== -1 && tx.meta) {
            const pre = tx.meta.preBalances[index]
            const post = tx.meta.postBalances[index]
            const diff = post - pre
            const solDiff = diff / 1000000000

            if (solDiff < 0) {
              type = TransactionTypes.SEND
              amount = Math.abs(solDiff).toFixed(4)
            } else if (solDiff > 0) {
              type = TransactionTypes.RECEIVE
              amount = solDiff.toFixed(4)
            } else {
              type = TransactionTypes.INTERACTION // Fees only? or Token transfer (SOL balance didn't change much besides fee)
            }
          }

          const record: ChainRecord = {
            id: sig.signature,
            chain: Chains.SOLANA,
            type: type,
            status: sig.err
              ? TransactionStatuses.FAILED
              : TransactionStatuses.COMPLETED,
            from: type === TransactionTypes.SEND ? address : "Unknown",
            to: type === TransactionTypes.SEND ? "Interaction" : address,
            amount: amount,
            token: "SOL",
            timestamp: sig.blockTime ? sig.blockTime * 1000 : Date.now(),
            fee: tx.meta ? (tx.meta.fee / 1000000000).toFixed(6) : undefined,
          }

          onRecord(record)
        } catch (e) {
          console.error(
            `[SolanaAdapter] Failed to fetch details for ${sig.signature}`,
            e,
          )
        }
      }
    } catch (error) {
      console.error("[SolanaAdapter] Error fetching history:", error)
    }
  }

  isValidAddress(address: string): boolean {
    // Basic Base58 check: alphanumeric, no 0, O, I, l
    // Length usually 32-44
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
  }

  private async rpcCall<T>(method: string, params: any[]): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "history-sdk",
        method,
        params,
      }),
    })
    const json = await response.json()
    if (json.error) {
      throw new Error(json.error.message)
    }
    return json.result
  }
}
