import type { ChainId } from "@lifi/sdk"
import {
  ChainIdToName,
  ChainIds,
  ChainNameToId,
  EvmChainIds,
} from "@aryxn/chain-constants"

/**
 * Validate blockchain address format
 */
export function validateAddress(address: string, chainId: ChainId): boolean {
  if (!address) return false

  if (EvmChainIds.includes(Number(chainId) as (typeof EvmChainIds)[number])) {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  if (Number(chainId) === ChainIds.SOLANA) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
  }

  // Default: assume EVM format for unknown chains
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Get address placeholder based on chain
 */
export function getAddressPlaceholder(chainId: ChainId): string {
  if (EvmChainIds.includes(Number(chainId) as (typeof EvmChainIds)[number])) {
    return "0x..."
  }

  if (Number(chainId) === ChainIds.SOLANA) {
    return "Base58 address..."
  }

  return "Enter address..."
}

/**
 * Get address example based on chain
 */
export function getAddressExample(chainId: ChainId): string {
  if (EvmChainIds.includes(Number(chainId) as (typeof EvmChainIds)[number])) {
    return "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }

  if (Number(chainId) === ChainIds.SOLANA) {
    return "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK"
  }

  return ""
}

/**
 * Get human-readable chain name
 */
export function getChainName(chainId: ChainId): string {
  return ChainIdToName[Number(chainId)] || `Chain ${chainId}`
}

/**
 * Check if chain uses EVM addresses
 */
export function isEVMChain(chainId: ChainId): boolean {
  return EvmChainIds.includes(Number(chainId) as (typeof EvmChainIds)[number])
}

/**
 * Get ChainId from chain name
 */
export function getChainIdFromName(chainName: string): ChainId | null {
  const chainId =
    ChainNameToId[chainName.toLowerCase() as keyof typeof ChainNameToId]
  return (chainId as ChainId | undefined) || null
}
