import { Chains } from "./chains"

export const PaymentTokenSymbols = [
  "AR",
  "ETH",
  "SOL",
  "V2EX",
  "SUI",
  "BTC",
  "USDC",
  "USDT",
] as const

export type PaymentTokenSymbol = (typeof PaymentTokenSymbols)[number]

export interface PaymentTokenMetadataItem {
  chain: string
  decimals: number
  symbol: PaymentTokenSymbol
  coingeckoId: string
}

export const PaymentTokenMetadata: Record<
  PaymentTokenSymbol,
  PaymentTokenMetadataItem
> = {
  AR: {
    chain: Chains.ARWEAVE,
    decimals: 12,
    symbol: "AR",
    coingeckoId: "arweave",
  },
  ETH: {
    chain: Chains.ETHEREUM,
    decimals: 18,
    symbol: "ETH",
    coingeckoId: "ethereum",
  },
  SOL: {
    chain: Chains.SOLANA,
    decimals: 9,
    symbol: "SOL",
    coingeckoId: "solana",
  },
  V2EX: {
    chain: Chains.SOLANA,
    decimals: 9,
    symbol: "V2EX",
    coingeckoId: "solana",
  },
  SUI: {
    chain: Chains.SUI,
    decimals: 9,
    symbol: "SUI",
    coingeckoId: "sui",
  },
  BTC: {
    chain: Chains.BITCOIN,
    decimals: 8,
    symbol: "BTC",
    coingeckoId: "bitcoin",
  },
  USDC: {
    chain: Chains.ETHEREUM,
    decimals: 6,
    symbol: "USDC",
    coingeckoId: "usd-coin",
  },
  USDT: {
    chain: Chains.ETHEREUM,
    decimals: 6,
    symbol: "USDT",
    coingeckoId: "tether",
  },
}

export const UploadPaymentSupportedChains = [
  Chains.SOLANA,
  Chains.ETHEREUM,
  Chains.SUI,
  Chains.ARWEAVE,
] as const

export const UploadSelectablePaymentTokens = [
  "USDT",
  "USDC",
  "ETH",
  "SOL",
  "SUI",
  "AR",
  "V2EX",
] as const satisfies readonly PaymentTokenSymbol[]

export const UploadTokenNativeChainBySymbol: Partial<
  Record<PaymentTokenSymbol, string>
> = {
  AR: Chains.ARWEAVE,
  ETH: Chains.ETHEREUM,
  USDC: Chains.ETHEREUM,
  USDT: Chains.ETHEREUM,
  SOL: Chains.SOLANA,
  SUI: Chains.SUI,
  V2EX: Chains.SOLANA,
}
