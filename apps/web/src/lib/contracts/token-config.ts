/**
 * Token configuration and utility functions
 */

import type { Address } from "@aryxn/wallet-core"
import { ChainIds } from "@aryxn/chain-constants"
import { TOKEN_MAPPING } from "./addresses"

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
  chainId: number
}

/**
 * Supported tokens - populated dynamically or statically per chain
 */
export const SUPPORTED_TOKENS: TokenInfo[] = [
  // Ethereum Mainnet
  {
    symbol: "USDC",
    name: "USD Coin",
    address: TOKEN_MAPPING[ChainIds.ETHEREUM].USDC,
    decimals: 6,
    coingeckoId: "usd-coin",
    chainId: ChainIds.ETHEREUM,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: TOKEN_MAPPING[ChainIds.ETHEREUM].WETH,
    decimals: 18,
    coingeckoId: "weth",
    chainId: ChainIds.ETHEREUM,
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    address: TOKEN_MAPPING[ChainIds.ETHEREUM].WBTC,
    decimals: 8,
    coingeckoId: "wrapped-bitcoin",
    chainId: ChainIds.ETHEREUM,
  },
  
  // Base
  {
    symbol: "USDC",
    name: "USD Coin",
    address: TOKEN_MAPPING[ChainIds.BASE].USDC,
    decimals: 6,
    coingeckoId: "usd-coin",
    chainId: ChainIds.BASE,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: TOKEN_MAPPING[ChainIds.BASE].WETH,
    decimals: 18,
    coingeckoId: "weth",
    chainId: ChainIds.BASE,
  },
  {
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    address: TOKEN_MAPPING[ChainIds.BASE].CB_BTC,
    decimals: 8,
    coingeckoId: "coinbase-wrapped-btc",
    chainId: ChainIds.BASE,
  },

  // Arbitrum
  {
    symbol: "USDC",
    name: "USD Coin",
    address: TOKEN_MAPPING[ChainIds.ARBITRUM].USDC,
    decimals: 6,
    coingeckoId: "usd-coin",
    chainId: ChainIds.ARBITRUM,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: TOKEN_MAPPING[ChainIds.ARBITRUM].WETH,
    decimals: 18,
    coingeckoId: "weth",
    chainId: ChainIds.ARBITRUM,
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    address: TOKEN_MAPPING[ChainIds.ARBITRUM].WBTC,
    decimals: 8,
    coingeckoId: "wrapped-bitcoin",
    chainId: ChainIds.ARBITRUM,
  },
]

/**
 * Get tokens filtered by chainId
 */
export function getTokensByChainId(chainId: number): TokenInfo[] {
  return SUPPORTED_TOKENS.filter((token) => token.chainId === chainId)
}

/**
 * Legacy helper for account-based chain names
 */
export function getDexTokensByAccountChain(chain?: string): TokenInfo[] {
  // Map string chain names to ChainIds if possible
  const mapping: Record<string, number> = {
    ethereum: ChainIds.ETHEREUM,
    base: ChainIds.BASE,
    arbitrum: ChainIds.ARBITRUM,
  }
  
  const chainId = chain ? mapping[chain.toLowerCase()] : ChainIds.ETHEREUM
  return getTokensByChainId(chainId || ChainIds.ETHEREUM)
}

/**
 * Format bigint token amount to readable string
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
  if (fraction === 0n) return whole.toString()
  const fractionStr = fraction.toString().padStart(decimals, "0")
  const trimmed = fractionStr.slice(0, displayDecimals).replace(/0+$/, "")
  return trimmed ? `${whole}.${trimmed}` : whole.toString()
}

/**
 * Parse user input string to bigint token amount
 */
export function parseTokenAmount(input: string, decimals: number): bigint {
  if (!input || input === "" || isNaN(parseFloat(input))) return 0n
  const [whole = "0", fraction = ""] = input.split(".")
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals)
  return BigInt(whole + paddedFraction)
}

/**
 * Get token info by address and chainId
 */
export function getTokenByAddress(address: Address, chainId: number): TokenInfo | undefined {
  return SUPPORTED_TOKENS.find(
    (token) => 
      token.address.toLowerCase() === address.toLowerCase() && 
      token.chainId === chainId
  )
}

/**
 * Get token info by symbol and chainId
 */
export function getTokenBySymbol(symbol: string, chainId: number): TokenInfo | undefined {
  return SUPPORTED_TOKENS.find(
    (token) =>
      token.symbol.toUpperCase() === symbol.toUpperCase() &&
      token.chainId === chainId
  )
}

/**
 * Resolve a token's contract address on a specific destination chain by its symbol.
 * Returns undefined if the token is not configured for that chain.
 *
 * Example:
 *   getTokenAddressOnChain("USDC", ChainIds.POLYGON)
 *   // → "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
 */
export function getTokenAddressOnChain(
  symbol: string,
  chainId: number,
): Address | undefined {
  return getTokenBySymbol(symbol, chainId)?.address
}
