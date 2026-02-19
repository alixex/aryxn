import type { ChainId } from "@lifi/sdk"

/**
 * Validate blockchain address format
 */
export function validateAddress(address: string, chainId: ChainId): boolean {
  if (!address) return false

  // Ethereum and EVM-compatible chains (Polygon, Arbitrum, Optimism, etc.)
  // ChainIds: 1 (ETH), 137 (Polygon), 42161 (Arbitrum), 10 (Optimism), 56 (BSC), 43114 (Avalanche)
  const evmChains = [
    1, 137, 42161, 10, 56, 43114, 250, 25, 100, 8453, 59144, 534352,
  ]
  if (evmChains.includes(chainId)) {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  // Solana (ChainId: 1151111081099710)
  if (chainId === 1151111081099710) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
  }

  // Default: assume EVM format for unknown chains
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Get address placeholder based on chain
 */
export function getAddressPlaceholder(chainId: ChainId): string {
  const evmChains = [
    1, 137, 42161, 10, 56, 43114, 250, 25, 100, 8453, 59144, 534352,
  ]

  if (evmChains.includes(chainId)) {
    return "0x..."
  }

  if (chainId === 1151111081099710) {
    // Solana
    return "Base58 address..."
  }

  return "Enter address..."
}

/**
 * Get address example based on chain
 */
export function getAddressExample(chainId: ChainId): string {
  const evmChains = [
    1, 137, 42161, 10, 56, 43114, 250, 25, 100, 8453, 59144, 534352,
  ]

  if (evmChains.includes(chainId)) {
    return "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }

  if (chainId === 1151111081099710) {
    // Solana
    return "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK"
  }

  return ""
}

/**
 * Get human-readable chain name
 */
export function getChainName(chainId: ChainId): string {
  const chainNames: Record<number, string> = {
    1: "Ethereum",
    137: "Polygon",
    42161: "Arbitrum",
    10: "Optimism",
    56: "BSC",
    43114: "Avalanche",
    250: "Fantom",
    25: "Cronos",
    100: "Gnosis",
    8453: "Base",
    59144: "Linea",
    534352: "Scroll",
    1151111081099710: "Solana",
  }

  return chainNames[chainId] || `Chain ${chainId}`
}

/**
 * Check if chain uses EVM addresses
 */
export function isEVMChain(chainId: ChainId): boolean {
  const evmChains = [
    1, 137, 42161, 10, 56, 43114, 250, 25, 100, 8453, 59144, 534352,
  ]
  return evmChains.includes(chainId)
}

/**
 * Get ChainId from chain name
 */
export function getChainIdFromName(chainName: string): ChainId | null {
  const chainMap: Record<string, ChainId> = {
    ethereum: 1,
    eth: 1,
    polygon: 137,
    matic: 137,
    arbitrum: 42161,
    arb: 42161,
    optimism: 10,
    op: 10,
    bsc: 56,
    binance: 56,
    avalanche: 43114,
    avax: 43114,
    fantom: 250,
    ftm: 250,
    cronos: 25,
    gnosis: 100,
    base: 8453,
    linea: 59144,
    scroll: 534352,
    solana: 1151111081099710,
    sol: 1151111081099710,
  }

  return chainMap[chainName.toLowerCase()] || null
}
