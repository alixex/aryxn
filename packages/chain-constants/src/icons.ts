export const CHAIN_ICONS = {
  ethereum: "/assets/icons/ethereum.svg",
  bitcoin: "/assets/icons/bitcoin.svg",
  solana: "/assets/icons/solana.png",
  base: "/assets/icons/base.png",
  arbitrum: "/assets/icons/arbitrum.png",
  optimism: "/assets/icons/optimism.png",
  polygon: "/assets/icons/polygon.png",
  arweave: "/assets/icons/arweave.png",
  irys: "/assets/icons/irys.png",
} as const

export const TOKEN_ICONS = {
  USDT: "/assets/icons/usdt.png",
  USDC: "/assets/icons/usdc.png",
  AR: "/assets/icons/ar.png",
  BTC: "/assets/icons/btc.svg",
  ETH: "/assets/icons/eth.svg",
  SUI: "/assets/icons/sui.png",
  SOL: "/assets/icons/sol.png",
  V2ex: "/assets/icons/v2ex.png",
} as const

export type ChainIconKey = keyof typeof CHAIN_ICONS
export type TokenIconKey = keyof typeof TOKEN_ICONS
