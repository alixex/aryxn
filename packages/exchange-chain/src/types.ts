export type ExchangeType = "SWAP" | "BRIDGE"

export interface ExchangeConfig {
  ethereumContractAddress: string
  solanaProgramId: string
  tokenMappings?: Record<string, Record<string, string>>
}

export interface ExchangeRequest {
  fromChain: string
  toChain: string
  fromToken: string // Symbol or Address
  toToken: string // Symbol or Address
  fromAmount: string
  slippage?: number
  recipient?: string
}

export interface ExchangeRoute {
  type: ExchangeType
  fromChain: string
  toChain: string
  fromToken: string
  toToken: string
  fromAmount: string
  toAmount: string
  estimatedTime?: number
  feePercent?: number
  provider: string
  routeData: any // Quote or Route object for execution
}

export interface ExchangeStatus {
  id: string
  status: "PENDING" | "COMPLETED" | "FAILED"
  hash?: string
  message?: string
}
