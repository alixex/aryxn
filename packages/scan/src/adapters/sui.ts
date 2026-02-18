import {
  IHistoryAdapter,
  ChainRecord,
  OnRecordCallback,
  FetchOptions,
} from "../types"
import {
  Chains,
  TransactionTypes,
  TransactionType,
  TransactionStatuses,
  RPCs,
} from "@aryxn/constants"

interface SuiTxBlock {
  digest: string
  timestampMs: string
  from?: string // Not standard field in brief, usually needs parsing
  transaction?: {
    data: {
      sender: string
    }
  }
  effects?: {
    status: { status: string }
  }
}

export class SuiAdapter implements IHistoryAdapter {
  private endpoint = RPCs.SUI_MAINNET

  async fetchRecords(
    address: string,
    onRecord: OnRecordCallback,
    options?: FetchOptions,
  ): Promise<void> {
    try {
      const result = await this.rpcCall<any>("suix_queryTransactionBlocks", [
        {
          filter: { FromAddress: address },
          options: {
            showEffects: true,
            showInput: true,
            showBalanceChanges: true,
            limit: options?.limit || 10,
          },
        },
      ])

      if (!result || !result.data) return

      for (const tx of result.data) {
        let amount = "0"
        let token = "SUI"
        let type: TransactionType = TransactionTypes.INTERACTION

        // Look at balance changes
        if (tx.balanceChanges) {
          const myChange = tx.balanceChanges.find(
            (c: any) => c.owner?.AddressOwner === address,
          )
          if (myChange) {
            const val = BigInt(myChange.amount)
            // Negative means I spent (Sent + Fee)
            // This is rough.
            const valFloat = Number(val) / 1e9 // SUI decimals
            if (val < 0) {
              type = TransactionTypes.SEND
              amount = Math.abs(valFloat).toFixed(4)
            } else {
              type = TransactionTypes.RECEIVE
              amount = valFloat.toFixed(4)
            }
            // Check coinType for token?
            if (myChange.coinType !== "0x2::sui::SUI") {
              token = "Unknown Token" // Simplified
            }
          }
        } else {
          // Fallback if balance changes not requested or empty
          type = TransactionTypes.SEND // Since we filtered by FromAddress
        }

        const record: ChainRecord = {
          id: tx.digest,
          chain: Chains.SUI,
          type: type as any,
          status:
            tx.effects?.status?.status === "success"
              ? TransactionStatuses.COMPLETED
              : TransactionStatuses.FAILED,
          from: tx.transaction?.data?.sender || address,
          to: "Interaction", // Hard to find single 'to' in Move
          amount: amount,
          token: token,
          timestamp: parseInt(tx.timestampMs || Date.now().toString()),
        }

        onRecord(record)
      }
    } catch (error) {
      console.error("[SuiAdapter] Error fetching history:", error)
    }
  }

  isValidAddress(address: string): boolean {
    // Sui addresses are 32 bytes hex => 64 chars + 0x prefix = 66 chars
    // Sometimes represented shorter if leading zeros? usually full length in standardized format.
    // Let's accept 0x + hex
    return /^0x[a-fA-F0-9]{40,70}$/.test(address)
  }

  private async rpcCall<T>(method: string, params: any[]): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
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
