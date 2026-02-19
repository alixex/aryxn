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
