import { create } from "zustand"
import { AppSyncChains } from "@aryxn/chain-constants"
import { AggregateHistoryProvider, type ChainRecord } from "@aryxn/query-chain"
import { getEthereumRpcUrl } from "@/lib/chain"
import {
  clearBridgeTransactions,
  getBridgeSyncTimestamp,
  listBridgeTransactions,
  setBridgeSyncTimestamp,
  upsertBridgeTransaction,
} from "./bridge-history-repo"
import {
  upsertBridgeSwap,
  listBridgeSwaps as listBridgeSwapsFromRepo,
  getBridgeSwap as getBridgeSwapFromRepo,
} from "./bridge-swap-repo"
import type { BridgeSwapRecord } from "@/lib/bridge/route-types"

const HISTORY_SYNC_COOLDOWN_MS = 30 * 1000

export interface BridgeTransaction {
  id: string
  userAddress: string
  type: "SWAP" | "BRIDGE" | "SEND" | "RECEIVE" | "UNKNOWN"
  status: "PENDING" | "COMPLETED" | "FAILED"
  description: string
  timestamp: number
  hash?: string
  fromChain?: string
  toChain?: string
  amount?: string
  token?: string
  lastUpdate?: number // For tracking status updates
  fromChainId?: number // ChainId for resuming tracking
  toChainId?: number // ChainId for resuming tracking
}

interface BridgeHistoryState {
  transactions: BridgeTransaction[]
  syncing: boolean
  loaded: boolean
  lastSynced: Record<string, number> // key: "chain:address" -> timestamp
  addTransaction: (tx: BridgeTransaction) => void
  updateTransaction: (id: string, updates: Partial<BridgeTransaction>) => void
  clearHistory: () => void
  loadTransactions: (
    filterType?: "ALL" | "SWAP" | "SEND" | "RECEIVE" | "BRIDGE",
    filterAddress?: string,
  ) => Promise<void>
  getSyncCooldownLeft: (address: string) => Promise<number>
  syncWithChain: (chain: string, address: string) => Promise<void>
  // New bridge swap methods
  addBridgeSwap: (swap: BridgeSwapRecord) => Promise<void>
  updateBridgeSwapStatus: (
    id: string,
    status: BridgeSwapRecord["status"],
    error?: string,
  ) => Promise<void>
  getBridgeSwap: (id: string) => Promise<BridgeSwapRecord | null>
  listBridgeSwaps: () => Promise<BridgeSwapRecord[]>
}

// Initializing the provider
const historyProvider = new AggregateHistoryProvider(getEthereumRpcUrl())

export const useBridgeHistory = create<BridgeHistoryState>()((set, get) => ({
  transactions: [],
  syncing: false,
  loaded: false,
  lastSynced: {},
  addTransaction: (tx) => {
    set((state) => {
      const exists = state.transactions.find(
        (t) => t.hash && t.hash === tx.hash,
      )
      if (exists) return state
      return { transactions: [tx, ...state.transactions].slice(0, 100) }
    })

    void upsertBridgeTransaction(tx)
  },
  updateTransaction: (id, updates) => {
    let updatedTx: BridgeTransaction | null = null

    set((state) => {
      const transactions = state.transactions.map((tx) => {
        if (tx.id !== id) return tx
        updatedTx = { ...tx, ...updates }
        return updatedTx
      })
      return { transactions }
    })

    if (updatedTx) {
      void upsertBridgeTransaction(updatedTx)
    }
  },
  clearHistory: () => {
    set({ transactions: [] })
    void clearBridgeTransactions()
  },
  loadTransactions: async (filterType, filterAddress) => {
    const rows = await listBridgeTransactions({
      limit: 100,
      type: filterType,
      address: filterAddress,
    })
    set({ transactions: rows, loaded: true })
  },
  getSyncCooldownLeft: async (address) => {
    const now = Date.now()
    let maxRemaining = 0

    for (const chain of AppSyncChains) {
      const key = `${chain}:${address}`
      const memoryTs = get().lastSynced[key] || 0
      const persistedTs = await getBridgeSyncTimestamp(key)
      const lastTs = Math.max(memoryTs, persistedTs)

      if (!lastTs) continue

      const remaining = Math.max(0, HISTORY_SYNC_COOLDOWN_MS - (now - lastTs))
      if (remaining > maxRemaining) {
        maxRemaining = remaining
      }
    }

    return maxRemaining
  },
  syncWithChain: async (chain, address) => {
    if (get().syncing) return

    const key = `${chain}:${address}`
    const now = Date.now()
    const memoryTs = get().lastSynced[key] || 0
    const persistedTs = await getBridgeSyncTimestamp(key)
    const lastTs = Math.max(memoryTs, persistedTs)

    if (now - lastTs < HISTORY_SYNC_COOLDOWN_MS) {
      return
    }

    set({ syncing: true })

    try {
      await historyProvider.startSync(
        chain,
        address,
        (record: ChainRecord) => {
          set((state) => {
            const existingIndex = state.transactions.findIndex(
              (t) => t.hash === record.id || t.id === record.id,
            )

            if (existingIndex !== -1) {
              const updatedTransactions = [...state.transactions]
              const updatedTx: BridgeTransaction = {
                ...updatedTransactions[existingIndex],
                status: record.status as any,
              }
              updatedTransactions[existingIndex] = updatedTx
              void upsertBridgeTransaction(updatedTx)
              return { transactions: updatedTransactions }
            }

            const newTx: BridgeTransaction = {
              id: record.id,
              userAddress: address,
              hash: record.id,
              type: record.type as any,
              status: record.status as any,
              description: `${record.type} ${record.amount} ${record.token}`,
              timestamp: record.timestamp,
              amount: record.amount,
              token: record.token,
              fromChain: record.chain,
            }

            void upsertBridgeTransaction(newTx)
            return {
              transactions: [newTx, ...state.transactions].slice(0, 100),
            }
          })
        },
        true,
      )

      set((state) => ({
        lastSynced: { ...state.lastSynced, [key]: Date.now() },
      }))
      await setBridgeSyncTimestamp(key, Date.now())
    } finally {
      set({ syncing: false })
    }
  },
  addBridgeSwap: async (swap: BridgeSwapRecord) => {
    await upsertBridgeSwap(swap)
  },
  updateBridgeSwapStatus: async (
    id: string,
    status: BridgeSwapRecord["status"],
    error?: string,
  ) => {
    const swap = await getBridgeSwapFromRepo(id)
    if (swap) {
      await upsertBridgeSwap({
        ...swap,
        status,
        errorMessage: error,
        updatedAt: Date.now(),
      })
    }
  },
  getBridgeSwap: async (id: string) => {
    return getBridgeSwapFromRepo(id)
  },
  listBridgeSwaps: async () => {
    return listBridgeSwapsFromRepo({ limit: 100 })
  },
}))
