export const CHAIN_ICONS: Record<string, string> = {
  ethereum:
    "https://upload.wikimedia.org/wikipedia/commons/0/05/Ethereum_logo_2014.svg",
  bitcoin: "https://upload.wikimedia.org/wikipedia/commons/4/46/Bitcoin.svg",
  solana: "https://upload.wikimedia.org/wikipedia/commons/a/ae/Solana_logo.svg",
  base: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
  arbitrum:
    "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
  optimism:
    "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
  polygon:
    "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
  arweave: "https://www.arweave.org/brand/ar-logo-white.svg",
  irys: "https://www.arweave.org/brand/ar-logo-white.svg", // Using Arweave branding for Irys fallback
}

export type ChainIconType = keyof typeof CHAIN_ICONS
