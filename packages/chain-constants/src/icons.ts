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

export type ChainIconKey = keyof typeof CHAIN_ICONS
