import {
  IHistoryAdapter,
  OnRecordCallback,
  SearchOptions,
  SearchResult,
} from "./types"
import { EVMAdapter } from "./adapters/evm"
import { SolanaAdapter } from "./adapters/solana"
import { BitcoinAdapter } from "./adapters/bitcoin"
import { ArweaveAdapter } from "./adapters/arweave"
import { SuiAdapter } from "./adapters/sui"

export * from "./types"
export { ArweaveAdapter } from "./adapters/arweave"

export class AggregateHistoryProvider {
  private adapters: Map<string, IHistoryAdapter> = new Map()

  constructor(evmRpcUrl: string) {
    this.adapters.set("ethereum", new EVMAdapter(evmRpcUrl))
    this.adapters.set("solana", new SolanaAdapter())
    this.adapters.set("bitcoin", new BitcoinAdapter())
    this.adapters.set("arweave", new ArweaveAdapter())
    this.adapters.set("sui", new SuiAdapter())
  }

  // Simple in-memory cache for rate limiting: Map<"chain:address", timestamp>
  private lastSync: Map<string, number> = new Map()
  private readonly SYNC_COOLDOWN = 60000 // 1 minute

  /**
   * Starts an incremental synchronization.
   * Uses requestIdleCallback (if available) to avoid blocking main thread.
   */
  async startSync(
    chain: string,
    address: string,
    onRecord: OnRecordCallback,
    force = false,
  ): Promise<void> {
    const adapter = this.adapters.get(chain)
    if (!adapter) {
      console.warn(`No history adapter found for chain: ${chain}`)
      return
    }

    // 1. Validate Address
    if (!adapter.isValidAddress(address)) {
      // Quietly return, as it's expected when syncing all chains with one address
      return
    }

    // 2. Check Rate Limit
    const key = `${chain}:${address}`
    const now = Date.now()
    if (!force && this.lastSync.has(key)) {
      const last = this.lastSync.get(key)!
      if (now - last < this.SYNC_COOLDOWN) {
        console.log(`[History] Skipping sync for ${key}: cooldown active`)
        return
      }
    }
    this.lastSync.set(key, now)

    // Wrap in idle callback to handle processing
    const idleSync = async () => {
      await adapter.fetchRecords(address, (record) => {
        // Wrap individual record processing in idle too if needed
        if (
          typeof window !== "undefined" &&
          (window as any).requestIdleCallback
        ) {
          ;(window as any).requestIdleCallback(() => onRecord(record))
        } else {
          onRecord(record)
        }
      })
    }

    idleSync()
  }

  /**
   * Search for transactions/data on a specific chain
   */
  async search(chain: string, options: SearchOptions): Promise<SearchResult[]> {
    const adapter = this.adapters.get(chain)
    if (!adapter) {
      console.warn(`No adapter found for chain: ${chain}`)
      return []
    }

    // Check if adapter supports search (structural typing or interface check)
    if ("search" in adapter && typeof (adapter as any).search === "function") {
      return (adapter as any).search(options)
    }

    console.warn(`Adapter for ${chain} does not support search`)
    return []
  }
}
