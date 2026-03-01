/**
 * Contract and token address configuration
 */

import type { Address } from "@aryxn/wallet-core"
import { ChainIds } from "@aryxn/chain-constants"

/**
 * Universal Router contract addresses by Chain ID
 */
export const MULTI_HOP_SWAPPER_MAPPING: Record<number, Address> = {
  [ChainIds.ETHEREUM]: "0x0000000000000000000000000000000000000000", // TODO: Mainnet
  [ChainIds.BASE]: "0x0000000000000000000000000000000000000000", // TODO: Base
  [ChainIds.ARBITRUM]: "0x0000000000000000000000000000000000000000", // TODO: Arbitrum
  [ChainIds.OPTIMISM]: "0x0000000000000000000000000000000000000000", // TODO: Optimism
}

/**
 * Default swapper address for backward compatibility
 */
export const MULTI_HOP_SWAPPER_ADDRESS =
  MULTI_HOP_SWAPPER_MAPPING[ChainIds.ETHEREUM]

/**
 * Common token addresses by Chain ID
 */
export const TOKEN_MAPPING: Record<number, Record<string, Address>> = {
  [ChainIds.ETHEREUM]: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  },
  [ChainIds.BASE]: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    WETH: "0x4200000000000000000000000000000000000006",
    CB_BTC: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
  },
  [ChainIds.ARBITRUM]: {
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  },
  [ChainIds.OPTIMISM]: {
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    WETH: "0x4200000000000000000000000000000000000006",
    USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    WBTC: "0x68f180fcCe6836688e9084f035309E29Bf0A2095",
  },
}

/**
 * Help retrieve appropriate contract address
 */
export function getSwapperAddress(chainId: number): Address {
  return (
    MULTI_HOP_SWAPPER_MAPPING[chainId] ||
    MULTI_HOP_SWAPPER_MAPPING[ChainIds.ETHEREUM]
  )
}

/**
 * Get token address by symbol and chainId
 */
export function getTokenBySymbol(
  symbol: string,
  chainId: number,
): Address | undefined {
  return TOKEN_MAPPING[chainId]?.[symbol.toUpperCase()]
}
