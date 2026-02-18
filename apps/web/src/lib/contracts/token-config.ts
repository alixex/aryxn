/**
 * Token configuration and utility functions
 * Provides metadata and formatting helpers for supported tokens
 */

import type { Address } from "@aryxn/wallet-core"
import { TOKEN_ADDRESSES } from "./addresses"

/**
 * Token metadata interface
 */
export interface TokenInfo {
  symbol: string
  name: string
  address: Address
  decimals: number
  logoURI?: string
  coingeckoId?: string
  chain: "ethereum" | "solana" | "arweave" | "bitcoin" | "sui" | string
}

/**
 * Supported tokens with full metadata
 * Must match the 9 tokens configured in MultiHopSwapper contract
 */
export const SUPPORTED_TOKENS: TokenInfo[] = [
  {
    symbol: "USDT",
    name: "Tether USD",
    address: TOKEN_ADDRESSES.USDT,
    decimals: 6,
    coingeckoId: "tether",
    chain: "ethereum",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: TOKEN_ADDRESSES.USDC,
    decimals: 6,
    coingeckoId: "usd-coin",
    chain: "ethereum",
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    address: TOKEN_ADDRESSES.WBTC,
    decimals: 8,
    coingeckoId: "wrapped-bitcoin",
    chain: "ethereum",
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: TOKEN_ADDRESSES.WETH,
    decimals: 18,
    coingeckoId: "weth",
    chain: "ethereum",
  },
  {
    symbol: "SOL",
    name: "Wrapped SOL",
    address: TOKEN_ADDRESSES.SOL,
    decimals: 18,
    coingeckoId: "solana",
    chain: "solana",
  },
  {
    symbol: "AR",
    name: "Arweave",
    address: TOKEN_ADDRESSES.AR,
    decimals: 18,
    coingeckoId: "arweave",
    chain: "arweave",
  },
  {
    symbol: "PUMP",
    name: "PUMP",
    address: TOKEN_ADDRESSES.PUMP,
    decimals: 18,
    chain: "ethereum",
  },
  {
    symbol: "V2EX",
    name: "V2EX",
    address: TOKEN_ADDRESSES.V2EX,
    decimals: 18,
    chain: "ethereum",
  },
  {
    symbol: "SUI",
    name: "Sui",
    address: TOKEN_ADDRESSES.SUI,
    decimals: 18,
    coingeckoId: "sui",
    chain: "sui",
  },
]

/**
 * Format bigint token amount to readable string
 * @param amount - Raw token amount as bigint
 * @param decimals - Token decimals (e.g., 18 for most ERC20, 6 for USDC/USDT)
 * @param displayDecimals - Number of decimals to display (default: 6)
 * @returns Formatted string (e.g., "1.234567")
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  displayDecimals = 6,
): string {
  if (amount === 0n) return "0"

  const divisor = BigInt(10 ** decimals)
  const whole = amount / divisor
  const fraction = amount % divisor

  if (fraction === 0n) {
    return whole.toString()
  }

  // Pad fraction with leading zeros
  const fractionStr = fraction.toString().padStart(decimals, "0")

  // Trim to display decimals
  const trimmed = fractionStr.slice(0, displayDecimals).replace(/0+$/, "")

  return trimmed ? `${whole}.${trimmed}` : whole.toString()
}

/**
 * Parse user input string to bigint token amount
 * @param input - User input string (e.g., "1.23")
 * @param decimals - Token decimals
 * @returns Bigint representation of the amount
 */
export function parseTokenAmount(input: string, decimals: number): bigint {
  if (!input || input === "" || isNaN(parseFloat(input))) {
    return 0n
  }

  // Handle scientific notation
  const num = parseFloat(input)
  if (!Number.isFinite(num) || num < 0) {
    return 0n
  }

  // Split into whole and fractional parts
  const [whole = "0", fraction = ""] = input.split(".")

  // Pad or trim fraction to match decimals
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals)

  // Combine and convert to bigint
  const combined = whole + paddedFraction
  return BigInt(combined)
}

/**
 * Get token info by address
 */
export function getTokenByAddress(address: Address): TokenInfo | undefined {
  return SUPPORTED_TOKENS.find(
    (token) => token.address.toLowerCase() === address.toLowerCase(),
  )
}

/**
 * Get token info by symbol
 */
export function getTokenBySymbol(symbol: string): TokenInfo | undefined {
  return SUPPORTED_TOKENS.find(
    (token) => token.symbol.toUpperCase() === symbol.toUpperCase(),
  )
}

/**
 * Check if an address is a supported token
 */
export function isSupportedToken(address: Address): boolean {
  return SUPPORTED_TOKENS.some(
    (token) => token.address.toLowerCase() === address.toLowerCase(),
  )
}
