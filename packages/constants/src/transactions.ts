export const TransactionTypes = {
  SEND: "SEND",
  RECEIVE: "RECEIVE",
  SWAP: "SWAP",
  BRIDGE: "BRIDGE",
  UNKNOWN: "UNKNOWN",
  INTERACTION: "INTERACTION",
} as const

export type TransactionType =
  (typeof TransactionTypes)[keyof typeof TransactionTypes]

export const TransactionStatuses = {
  COMPLETED: "COMPLETED",
  PENDING: "PENDING",
  FAILED: "FAILED",
} as const

export type TransactionStatus =
  (typeof TransactionStatuses)[keyof typeof TransactionStatuses]
