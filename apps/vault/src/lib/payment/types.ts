export type PaymentToken =
  | "AR"
  | "ETH"
  | "SOL"
  | "V2EX"
  | "SUI"
  | "BTC"
  | "USDC"
  | "USDT"

export interface PaymentAccount {
  chain: string
  address: string
  isExternal: boolean
  alias?: string
}

export type UploadRedirectAction = "swap" | "bridge"

export type PaymentStatus =
  | "INITIATED"
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"

export type SilentPaymentType = "SWAP" | "BRIDGE" | "DIRECT"

export type TargetBalanceType = "IRYS" | "WALLET" | "ARWEAVE"

export interface PaymentFileMetadata {
  name: string
  size: number
  type?: string
  lastModified?: number
}

export interface PaymentIntent {
  id: string
  txHash?: string
  fromChain: string
  fromToken: string
  toToken: string
  arAddress: string
  fileMetadata?: PaymentFileMetadata
  status: PaymentStatus
  paymentType: SilentPaymentType
  targetBalanceType?: TargetBalanceType
  createdAt: number
  updatedAt: number
}
