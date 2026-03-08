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
  "MATIC",
  "AVAX",
  "BNB",
  "IRYS",
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
  MATIC: {
    chain: Chains.POLYGON,
    decimals: 18,
    symbol: "MATIC",
    coingeckoId: "matic-network",
  },
  AVAX: {
    chain: Chains.AVALANCHE,
    decimals: 18,
    symbol: "AVAX",
    coingeckoId: "avalanche-2",
  },
  BNB: {
    chain: Chains.BSC,
    decimals: 18,
    symbol: "BNB",
    coingeckoId: "binancecoin",
  },
  IRYS: {
    chain: Chains.IRYS,
    decimals: 18, // Irys uses 18 decimals like ETH
    symbol: "IRYS",
    coingeckoId: "irys", // placeholder
  },
}

export const UploadPaymentSupportedChains = [
  Chains.SOLANA,
  Chains.ETHEREUM,
  Chains.SUI,
  Chains.ARWEAVE,
  Chains.POLYGON,
  Chains.ARBITRUM,
  Chains.OPTIMISM,
  Chains.BASE,
  Chains.BSC,
  Chains.AVALANCHE,
  Chains.IRYS,
] as const

export const UploadSelectablePaymentTokens = [
  "USDT",
  "USDC",
  "ETH",
  "SOL",
  "SUI",
  "AR",
  "V2EX",
  "MATIC",
  "AVAX",
  "BNB",
  "IRYS",
] as const satisfies readonly PaymentTokenSymbol[]

export const UploadSelectableTokensByAccountChain: Readonly<
  Partial<Record<string, readonly PaymentTokenSymbol[]>>
> = {
  [Chains.ARWEAVE]: ["AR"],
  [Chains.ETHEREUM]: ["ETH", "USDC", "USDT"],
  [Chains.SOLANA]: ["SOL", "USDC", "USDT", "V2EX"],
  [Chains.SUI]: ["SUI", "USDC", "USDT"],
  [Chains.POLYGON]: ["MATIC", "USDC", "USDT"],
  [Chains.BSC]: ["BNB", "USDC", "USDT"],
  [Chains.AVALANCHE]: ["AVAX", "USDC", "USDT"],
  [Chains.ARBITRUM]: ["ETH", "USDC", "USDT"],
  [Chains.OPTIMISM]: ["ETH", "USDC", "USDT"],
  [Chains.BASE]: ["ETH", "USDC", "USDT"],
  [Chains.IRYS]: ["IRYS"],
} as const

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
  MATIC: Chains.POLYGON,
  AVAX: Chains.AVALANCHE,
  BNB: Chains.BSC,
  IRYS: Chains.IRYS,
}

export const DexTokenSymbolsByAccountChain: Readonly<
  Partial<Record<string, readonly string[]>>
> = {
  [Chains.ETHEREUM]: ["USDT", "USDC", "WBTC", "WETH"],
  [Chains.SOLANA]: ["SOL", "USDC", "USDT", "V2EX"],
  [Chains.SUI]: ["SUI", "USDC", "USDT"],
  [Chains.ARWEAVE]: ["AR"],
  [Chains.IRYS]: ["IRYS"],
} as const
