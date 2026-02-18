import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface BridgeTransaction {
  id: string
  type: "SWAP" | "BRIDGE" | "SEND"
  status: "PENDING" | "COMPLETED" | "FAILED"
  description: string
  timestamp: number
  hash?: string
  fromChain?: string
  toChain?: string
  amount?: string
  token?: string
}

interface BridgeHistoryState {
  transactions: BridgeTransaction[]
  addTransaction: (tx: BridgeTransaction) => void
  updateTransaction: (id: string, updates: Partial<BridgeTransaction>) => void
  clearHistory: () => void
}

export const useBridgeHistory = create<BridgeHistoryState>()(
  persist(
    (set) => ({
      transactions: [],
      addTransaction: (tx) =>
        set((state) => ({
          transactions: [tx, ...state.transactions],
        })),
      updateTransaction: (id, updates) =>
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id ? { ...tx, ...updates } : tx,
          ),
        })),
      clearHistory: () => set({ transactions: [] }),
    }),
    {
      name: "aryxn-bridge-history",
    },
  ),
)
