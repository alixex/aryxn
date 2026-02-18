import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { AggregateHistoryProvider, type ChainRecord } from "@aryxn/query-chain"
import { getEthereumRpcUrl } from "@/lib/chain/rpc-config"
import { createEncryptedStorage } from "./encrypted-storage"

export interface BridgeTransaction {
  id: string
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
  lastSynced: Record<string, number> // key: "chain:address" -> timestamp
  addTransaction: (tx: BridgeTransaction) => void
  updateTransaction: (id: string, updates: Partial<BridgeTransaction>) => void
  clearHistory: () => void
  syncWithChain: (chain: string, address: string) => Promise<void>
}

// Initializing the provider
const historyProvider = new AggregateHistoryProvider(getEthereumRpcUrl())

export const useBridgeHistory = create<BridgeHistoryState>()(
  persist(
    (set, get) => ({
      transactions: [],
      syncing: false,
      lastSynced: {},
      addTransaction: (tx) =>
        set((state) => {
          // Deduplicate if a transaction with the same hash already exists
          const exists = state.transactions.find(
            (t) => t.hash && t.hash === tx.hash,
          )
          if (exists) return state
          return { transactions: [tx, ...state.transactions].slice(0, 100) }
        }),
      updateTransaction: (id, updates) =>
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id ? { ...tx, ...updates } : tx,
          ),
        })),
      clearHistory: () => set({ transactions: [] }),
      syncWithChain: async (chain, address) => {
        if (get().syncing) return

        // Persistent Rate Limit (e.g., 5 minutes)
        const key = `${chain}:${address}`
        const lastSyncTime = get().lastSynced[key] || 0
        const now = Date.now()
        // If synced less than 5 minutes ago, skip
        if (now - lastSyncTime < 5 * 60 * 1000) {
          console.log(
            `[BridgeHistory] Skipping sync for ${key}: cached recently`,
          )
          return
        }

        set({ syncing: true })

        try {
          await historyProvider.startSync(
            chain,
            address,
            (record: ChainRecord) => {
              // Incremental Update
              set((state) => {
                const existingIndex = state.transactions.findIndex(
                  (t) => t.hash === record.id || t.id === record.id,
                )

                if (existingIndex !== -1) {
                  // Update existing record (e.g. status promotion)
                  const updatedTransactions = [...state.transactions]
                  updatedTransactions[existingIndex] = {
                    ...updatedTransactions[existingIndex],
                    status: record.status as any,
                    // Don't overwrite description if we have a better local one
                  }
                  return { transactions: updatedTransactions }
                } else {
                  // Add new record
                  const newTx: BridgeTransaction = {
                    id: record.id,
                    hash: record.id,
                    type: record.type as any,
                    status: record.status as any,
                    description: `${record.type} ${record.amount} ${record.token}`,
                    timestamp: record.timestamp,
                    amount: record.amount,
                    token: record.token,
                    fromChain: record.chain,
                  }
                  return {
                    transactions: [newTx, ...state.transactions].slice(0, 100),
                  }
                }
              })
            },
            true, // Force sync in provider because we handle rate limiting here at persistent level
          )

          // Update last synced time
          set((state) => ({
            lastSynced: { ...state.lastSynced, [key]: Date.now() },
          }))
        } finally {
          set({ syncing: false })
        }
      },
    }),
    {
      name: "aryxn-bridge-history",
      storage: createJSONStorage(() => createEncryptedStorage()),
    },
  ),
)
