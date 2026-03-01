/**
 * Sui token configuration
 */

export interface SuiTokenInfo {
  symbol: string
  name: string
  type: string // Sui token type identifier
  decimals: number
  coingeckoId?: string
}

/**
 * Common tokens on Sui network
 */
export const SUI_TOKENS: SuiTokenInfo[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    type: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
    decimals: 6,
    coingeckoId: "usd-coin",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    type: "0xc060006111016b8a020ad5b33f3f92d7c764efdac6ebf3a789b6e3c3b6e06e7e::coin::COIN",
    decimals: 6,
    coingeckoId: "tether",
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    type: "0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN",
    decimals: 8,
    coingeckoId: "weth",
  },
  {
    symbol: "wUSDC",
    name: "Wrapped USDC (Wormhole)",
    type: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
    decimals: 6,
    coingeckoId: "usd-coin",
  },
]

/**
 * Format Sui token amount to readable string
 */
export function formatSuiTokenAmount(
  amount: bigint,
  decimals: number,
  displayDecimals = 4,
): string {
  if (amount === 0n) return "0"

  const divisor = BigInt(10 ** decimals)
  const whole = amount / divisor
  const fraction = amount % divisor

  if (fraction === 0n) {
    return whole.toString()
  }

  const fractionStr = fraction.toString().padStart(decimals, "0")
  const trimmed = fractionStr.slice(0, displayDecimals).replace(/0+$/, "")

  return trimmed ? `${whole}.${trimmed}` : whole.toString()
}
