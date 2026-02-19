export const Chains = {
  ETHEREUM: "ethereum",
  SOLANA: "solana",
  BITCOIN: "bitcoin",
  ARWEAVE: "arweave",
  SUI: "sui",
} as const

export type ChainType = (typeof Chains)[keyof typeof Chains]

export const ChainIds = {
  ETHEREUM: 1,
  POLYGON: 137,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  BSC: 56,
  AVALANCHE: 43114,
  FANTOM: 250,
  CRONOS: 25,
  GNOSIS: 100,
  BASE: 8453,
  LINEA: 59144,
  SCROLL: 534352,
  SOLANA: 1151111081099710,
} as const

export const EvmChainIds = [
  ChainIds.ETHEREUM,
  ChainIds.POLYGON,
  ChainIds.ARBITRUM,
  ChainIds.OPTIMISM,
  ChainIds.BSC,
  ChainIds.AVALANCHE,
  ChainIds.FANTOM,
  ChainIds.CRONOS,
  ChainIds.GNOSIS,
  ChainIds.BASE,
  ChainIds.LINEA,
  ChainIds.SCROLL,
] as const

export const ChainNameToId = {
  ethereum: ChainIds.ETHEREUM,
  eth: ChainIds.ETHEREUM,
  polygon: ChainIds.POLYGON,
  matic: ChainIds.POLYGON,
  arbitrum: ChainIds.ARBITRUM,
  arb: ChainIds.ARBITRUM,
  optimism: ChainIds.OPTIMISM,
  op: ChainIds.OPTIMISM,
  bsc: ChainIds.BSC,
  binance: ChainIds.BSC,
  avalanche: ChainIds.AVALANCHE,
  avax: ChainIds.AVALANCHE,
  fantom: ChainIds.FANTOM,
  ftm: ChainIds.FANTOM,
  cronos: ChainIds.CRONOS,
  gnosis: ChainIds.GNOSIS,
  base: ChainIds.BASE,
  linea: ChainIds.LINEA,
  scroll: ChainIds.SCROLL,
  solana: ChainIds.SOLANA,
  sol: ChainIds.SOLANA,
} as const

export const ChainIdToName: Record<number, string> = {
  [ChainIds.ETHEREUM]: "Ethereum",
  [ChainIds.POLYGON]: "Polygon",
  [ChainIds.ARBITRUM]: "Arbitrum",
  [ChainIds.OPTIMISM]: "Optimism",
  [ChainIds.BSC]: "BSC",
  [ChainIds.AVALANCHE]: "Avalanche",
  [ChainIds.FANTOM]: "Fantom",
  [ChainIds.CRONOS]: "Cronos",
  [ChainIds.GNOSIS]: "Gnosis",
  [ChainIds.BASE]: "Base",
  [ChainIds.LINEA]: "Linea",
  [ChainIds.SCROLL]: "Scroll",
  [ChainIds.SOLANA]: "Solana",
}
