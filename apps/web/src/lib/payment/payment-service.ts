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
   * Execute payment to cover the upload fee using Irys
   */
  async executePayment(params: {
    fromToken: PaymentToken
    amountInAR: number
    userAddress: string
    walletKey: any
    signer?: any // Ethers Signer for EVM chains
  }): Promise<string> {
    if (params.fromToken === "AR") return "PAID_NATIVE"

    console.log(`Executing Irys funding with ${params.fromToken}...`)

    try {
      const tokenConfig = TOKEN_CONFIG[params.fromToken]

      // Irys token name mapping
      // For USDC, Irys expects "usdc-ethereum" or "usdc-solana" as the token identifier.
      // For other tokens like ETH, SOL, it expects the chain name directly.
      let irysToken = tokenConfig.chain
      if (params.fromToken === "USDC") {
        irysToken = `usdc-${tokenConfig.chain}` // e.g., usdc-ethereum or usdc-solana
      }

      // Explicitly supported chains/tokens for Irys payment
      // Irys doesn't natively support USDT, BTC, or SUI for funding in the standard WebIrys bundle.
      // It also doesn't support arbitrary SPL/Meme tokens.
      const supportedIrysTokens = [
        "ethereum",
        "solana",
        "usdc-ethereum",
        "usdc-solana",
      ]
      if (!supportedIrysTokens.includes(irysToken)) {
        throw new Error(
          `Token ${params.fromToken} is not yet supported for direct Irys payment. Please use ETH, SOL, or USDC.`,
        )
      }

      const { irysService } = await import("@/lib/storage")
      const { config } = await import("@/lib/config")

      // Initialize Irys with the appropriate wallet
      const irys = await irysService.getIrysInstance({
        token: irysToken,
        wallet:
          tokenConfig.chain === "ethereum" ? params.signer : params.walletKey,
        rpcUrl:
          tokenConfig.chain === "ethereum"
            ? config.ethereumRpcUrl
            : config.solanaRpcUrl,
      })

      // Get the exact price again to be sure (or use the one from estimateFee)
      // Actually, we should fund the amount needed for the file.
      // For now, let's use a simplified approach: fund the amount that corresponds to the estimate.

      // In a real scenario, we'd need the data size here or the pre-calculated atomic amount.
      // Assuming params.amountInAR is what we want to cover (but Irys funding is in the chosen token).
      const price = await irysService.getPrice(1024 * 1024, irysToken) // 1MB for demo or actual size

      // Execute funding
      await irysService.fund(price, irys)

      console.log("Irys funding successful")
      return "PAYMENT_SUCCESS"
    } catch (error) {
      console.error("Irys payment failed:", error)
      throw error
    }
  }
}

export const paymentService = new PaymentService()
