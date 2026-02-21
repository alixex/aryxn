import type {
  IHistoryAdapter,
  ChainRecord,
  OnRecordCallback,
  FetchOptions,
} from "../types"
import {
  Chains,
  TransactionTypes,
  TransactionStatuses,
  RPCs,
} from "@aryxn/chain-constants"

interface BitcoinTx {
  txid: string
  version: number
  locktime: number
  vin: {
    txid: string
    vout: number
    prevout: {
      scriptpubkey: string
      scriptpubkey_asm: string
      scriptpubkey_type: string
      scriptpubkey_address: string
      value: number
    }
    scriptsig: string
    scriptsig_asm: string
    witness: string[]
    is_coinbase: boolean
    sequence: number
  }[]
  vout: {
    scriptpubkey: string
    scriptpubkey_asm: string
    scriptpubkey_type: string
    scriptpubkey_address: string
    value: number
  }[]
  size: number
  weight: number
  fee: number
  status: {
    confirmed: boolean
    block_height?: number
    block_hash?: string
    block_time?: number
  }
}

export class BitcoinAdapter implements IHistoryAdapter {
  // Use mempool.space for mainnet. For testnet usage, this should be configurable.
  private endpoint = RPCs.BITCOIN_MEMPOOL

  async fetchRecords(
    address: string,
    onRecord: OnRecordCallback,
    _options?: FetchOptions,
  ): Promise<void> {
    try {
      const response = await fetch(`${this.endpoint}/address/${address}/txs`)

      if (!response.ok) {
        // 400/404 might mean address has no history or invalid format
        console.warn(
          `[BitcoinAdapter] Failed to fetch. Status: ${response.status}`,
        )
        return
      }

      const txs: BitcoinTx[] = await response.json()

      for (const tx of txs) {
        // Determine flow (Send/Receive)
        // Simple logic: if any input address == my address, it's a SEND (roughly)
        // This is a simplification. UTXO model is complex.

        const isSend = tx.vin.some(
          (vin) => vin.prevout?.scriptpubkey_address === address,
        )
        const type = isSend ? TransactionTypes.SEND : TransactionTypes.RECEIVE

        // Calculate amount
        // If Send: Input Total - Output to Change (this is hard without knowing change address)
        // Simplified: value is total output value minus self-transfer?
        // For history display, showing the total value transferred in the tx is often acceptable or just the first output that isn't self.

        let amountSat = 0
        let toAddress = ""

        if (isSend) {
          // Find output that is NOT my address
          const out = tx.vout.find((v) => v.scriptpubkey_address !== address)
          if (out) {
            amountSat = out.value
            toAddress = out.scriptpubkey_address
          } else {
            // Self transfer?
            amountSat = tx.vout[0]?.value || 0
            toAddress = tx.vout[0]?.scriptpubkey_address
          }
        } else {
          // Receive: Sum of outputs to my address
          amountSat = tx.vout
            .filter((v) => v.scriptpubkey_address === address)
            .reduce((acc, v) => acc + v.value, 0)
          toAddress = address // I am recipient
        }

        const record: ChainRecord = {
          id: tx.txid,
          chain: Chains.BITCOIN,
          type: type,
          status: tx.status.confirmed
            ? TransactionStatuses.COMPLETED
            : TransactionStatuses.PENDING,
          from: isSend ? address : "Internal/Unknown", // Hard to trace exact sender in UI without deep analysis
          to: toAddress,
          amount: (amountSat / 100000000).toFixed(8), // Satoshis to BTC
          token: "BTC",
          timestamp: tx.status.block_time
            ? tx.status.block_time * 1000
            : Date.now(),
          fee: (tx.fee / 100000000).toFixed(8),
        }

        onRecord(record)
      }
    } catch (error) {
      console.error("[BitcoinAdapter] Error fetching history:", error)
    }
  }

  isValidAddress(address: string): boolean {
    // Basic regex for P2PKH, P2SH, Bech32
    // 1... (P2PKH), 3... (P2SH), bc1... (Bech32)
    // Lengths vary, typically 26-62 chars
    return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address)
  }
}
