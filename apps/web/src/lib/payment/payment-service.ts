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

    try {
      const tokenConfig = TOKEN_CONFIG[token]
      const irysToken = tokenConfig.chain // Irys uses chain name for token parameter often, or token symbol

      // Irys getPrice returns atomic units
      const { irysService } = await import("@/lib/storage")
      const atomicPrice = await irysService.getPrice(dataSize, irysToken)

      const tokenAmount = atomicPrice / 10 ** tokenConfig.decimals

      return {
        arAmount: arFee.ar,
        tokenAmount,
        formatted: `${tokenAmount.toFixed(6)} ${token}`,
      }
    } catch (error) {
      console.warn("Failed to get Irys price, falling back to 0", error)
      return {
        arAmount: arFee.ar,
        tokenAmount: 0,
        formatted: `Error`,
      }
    }
  }

  /**
   * Execute payment to cover the upload fee
   * Returns a status indicating the payment result and method used
   */
  async executePayment(params: {
    fromToken: PaymentToken
    amountInAR: number
    userAddress: string
    walletKey: any
    signer?: any // Ethers Signer for EVM chains
  }): Promise<
    "PAID_NATIVE" | "PAID_IRYS" | "REQUIRE_BRIDGE" | "PAYMENT_FAILED"
  > {
    // TIER 1: Native AR
    if (params.fromToken === "AR") {
      console.log("Using native Arweave payment channel.")
      return "PAID_NATIVE"
    }

    const tokenConfig = TOKEN_CONFIG[params.fromToken]

    // TIER 2: Irys Rapid Payment (ETH, SOL, USDC)
    let irysToken = tokenConfig.chain
    if (params.fromToken === "USDC") {
      irysToken = `usdc-${tokenConfig.chain}`
    }

    const supportedIrysTokens = [
      "ethereum",
      "solana",
      "usdc-ethereum",
      "usdc-solana",
    ]

    if (supportedIrysTokens.includes(irysToken)) {
      console.log(`Executing rapid Irys funding with ${params.fromToken}...`)
      try {
        const { irysService } = await import("@/lib/storage")
        const { config } = await import("@/lib/config")

        const irys = await irysService.getIrysInstance({
          token: irysToken,
          wallet:
            tokenConfig.chain === "ethereum" ? params.signer : params.walletKey,
          rpcUrl:
            tokenConfig.chain === "ethereum"
              ? config.ethereumRpcUrl
              : config.solanaRpcUrl,
        })

        // Estimate 1MB size for funding demo or use actual size if known
        const price = await irysService.getPrice(1024 * 1024, irysToken)
        await irysService.fund(price, irys)

        console.log("Irys rapid funding successful")
        return "PAID_IRYS"
      } catch (error) {
        console.error("Irys rapid payment failed:", error)
        return "PAYMENT_FAILED"
      }
    }

    // TIER 3: Cross-Chain / Bridge Fallback (BTC, USDT, Memes)
    // We import BridgeService dynamically to avoid circular dependencies if any
    const { BridgeService } = await import("@aryxn/cross-chain")

    if (BridgeService.requiresBridge(params.fromToken)) {
      console.log(`Token ${params.fromToken} requires cross-chain bridge/swap.`)
      return "REQUIRE_BRIDGE"
    }

    return "PAYMENT_FAILED"
  }
}

export const paymentService = new PaymentService()
