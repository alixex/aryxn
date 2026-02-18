export const Chains = {
  ETHEREUM: "ethereum",
  SOLANA: "solana",
  BITCOIN: "bitcoin",
  ARWEAVE: "arweave",
  SUI: "sui",
} as const

export type ChainType = (typeof Chains)[keyof typeof Chains]
