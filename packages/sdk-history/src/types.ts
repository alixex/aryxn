import { ChainType, TransactionType, TransactionStatus } from "@aryxn/constants"

export type { ChainType, TransactionType, TransactionStatus }

export interface ChainRecord {
  id: string // Hash
  chain: ChainType
  type: TransactionType
  status: TransactionStatus
  from: string
  to: string
  amount: string
  token: string
  timestamp: number
  fee?: string
  memo?: string
}

export interface FetchOptions {
  limit?: number
  offset?: number
  startBlock?: number
}

export type OnRecordCallback = (record: ChainRecord) => void

export interface IHistoryAdapter {
  fetchRecords(
    address: string,
    onRecord: OnRecordCallback,
    options?: FetchOptions,
  ): Promise<void>

  isValidAddress(address: string): boolean
}
