/**
 * Contract and token address configuration
 * Update these addresses after deploying contracts
 */

import type { Address } from "@aryxn/wallet-core"

/**
 * MultiHopSwapper contract address
 * TODO: Replace with actual deployed contract address after deployment
 */
export const MULTI_HOP_SWAPPER_ADDRESS: Address =
  "0x0000000000000000000000000000000000000000" // Placeholder

/**
 * Supported token addresses - must match MultiHopSwapper contract configuration
 */
export const TOKEN_ADDRESSES = {
  // Stablecoins
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address,
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,

  // Major tokens
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as Address,
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address,

  // Wrapped tokens from other chains
  SOL: "0xD31a59c85aE9D8edEFeC411D448f90d4b0d81299" as Address,
  AR: "0x4fadc7a98f2dc96510e42dd1a74141eeae0c1543" as Address,
  V2EX: "0x9raUVuzeWUk53co63M4WXLWPWE4Xc6Lpn7RS9dnkpump" as Address, // TODO: Fix invalid address format in contract
  SUI: "0x0b275cfB78b7F8Ffc9D1e66fBa5e7F61Db2c3F20" as Address,
} as const

/**
 * Type-safe helper to get all token addresses
 */
export function getAllTokenAddresses(): Address[] {
  return Object.values(TOKEN_ADDRESSES)
}

/**
 * Get token address by symbol
 */
export function getTokenAddress(symbol: keyof typeof TOKEN_ADDRESSES): Address {
  return TOKEN_ADDRESSES[symbol]
}
