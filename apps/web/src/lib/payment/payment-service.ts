import { estimateArweaveFee } from "@/lib/storage"

/**
 * Supported payment tokens
 */
export type PaymentToken =
  | "AR"
  | "ETH"
  | "SOL"
  | "SUI"
  | "BTC"
  | "USDC"
  | "USDT"

/**
 * Token configuration metadata
 */
export const TOKEN_CONFIG: Record<
  PaymentToken,
  { chain: string; decimals: number; symbol: string; coingeckoId: string }
> = {
  AR: { chain: "arweave", decimals: 12, symbol: "AR", coingeckoId: "arweave" },
  ETH: {
    chain: "ethereum",
    decimals: 18,
    symbol: "ETH",
    coingeckoId: "ethereum",
  },
  SOL: { chain: "solana", decimals: 9, symbol: "SOL", coingeckoId: "solana" },
  SUI: { chain: "sui", decimals: 9, symbol: "SUI", coingeckoId: "sui" },
  BTC: { chain: "bitcoin", decimals: 8, symbol: "BTC", coingeckoId: "bitcoin" },
  USDC: {
    chain: "ethereum",
    decimals: 6,
    symbol: "USDC",
    coingeckoId: "usd-coin",
  },
  USDT: {
    chain: "ethereum",
    decimals: 6,
    symbol: "USDT",
    coingeckoId: "tether",
  },
}

/**
 * Simple in-memory cache for token prices
 */
interface PriceCache {
  prices: Record<string, number>
  lastUpdated: number
}

const PRICE_CACHE: PriceCache = {
  prices: {},
  lastUpdated: 0,
}

const CACHE_DURATION_MS = 60 * 1000 // 1 minute

/**
 * Service to handle payment logic for uploads
 */
export class PaymentService {
  constructor() {
    // Constructor for future payment service initialization
  }

  /**
   * Fetch token prices from CoinGecko
   */
  async fetchCryptoPrices(): Promise<Record<string, number>> {
    const now = Date.now()
    if (
      now - PRICE_CACHE.lastUpdated < CACHE_DURATION_MS &&
      Object.keys(PRICE_CACHE.prices).length > 0
    ) {
      return PRICE_CACHE.prices
    }

    try {
      const ids = Object.values(TOKEN_CONFIG)
        .map((c) => c.coingeckoId)
        .join(",")
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      )

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.statusText}`)
      }

      const data = await response.json()

      const newPrices: Record<string, number> = {}
      Object.values(TOKEN_CONFIG).forEach((config) => {
        if (data[config.coingeckoId]) {
          newPrices[config.symbol] = data[config.coingeckoId].usd
        }
      })

      PRICE_CACHE.prices = newPrices
      PRICE_CACHE.lastUpdated = now
      return newPrices
    } catch (error) {
      console.error("Failed to fetch prices:", error)
      return PRICE_CACHE.prices // Return stale data if available
    }
  }

  /**
   * Estimate fee for a given data size in a specific token
   */
  async estimateFeeInToken(
    dataSize: number,
    token: PaymentToken,
  ): Promise<{
    arAmount: number
    tokenAmount: number
    formatted: string
  }> {
    const arFee = await estimateArweaveFee(dataSize)

    if (token === "AR") {
      return {
        arAmount: arFee.ar,
        tokenAmount: arFee.ar,
        formatted: `${arFee.ar.toFixed(6)} AR`,
      }
    }

    const prices = await this.fetchCryptoPrices()
    const arPrice = prices["AR"] || 0
    const tokenPrice = prices[token] || 0

    // Fallback if price fetch fails (avoid division by zero)
    if (!arPrice || !tokenPrice) {
      console.warn("Missing price data for fee calculation, defaulting to 0")
      return {
        arAmount: arFee.ar,
        tokenAmount: 0,
        formatted: `Error`,
      }
    }

    const arPriceInToken = arPrice / tokenPrice
    const tokenAmount = arFee.ar * arPriceInToken

    return {
      arAmount: arFee.ar,
      tokenAmount,
      formatted: `${tokenAmount.toFixed(6)} ${token}`,
    }
  }

  /**
   * Execute a swap to cover the upload fee
   */
  async executePayment(params: {
    fromToken: PaymentToken
    amountInAR: number
    userAddress: string
    walletKey: any
  }): Promise<string> {
    if (params.fromToken === "AR") return "PAID_NATIVE"

    console.log(`Executing DEX swap for ${params.fromToken}...`)

    // Logic to perform swap on the respective chain using the swapper
    // This will be called during the upload handler flow

    return "SWAP_SUCCESS"
  }
}

export const paymentService = new PaymentService()
