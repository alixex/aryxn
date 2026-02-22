import { estimateArweaveFee } from "@/lib/storage"
import {
  Chains,
  PaymentTokenMetadata,
  COINGECKO_API_URL,
} from "@aryxn/chain-constants"
import type { PaymentAccount, PaymentToken } from "./types"
import {
  getIrysFundingToken,
  resolveUploadRedirectAction,
} from "./upload-payment-config"
import type { UploadRedirectAction, PaymentIntent } from "./types"
import { ExchangeRouter } from "@aryxn/exchange-chain"
import { PaymentRepository } from "./payment-repository"
import { config } from "@/lib/config"

/**
 * Token configuration metadata
 */
export const TOKEN_CONFIG: Record<
  PaymentToken,
  { chain: string; decimals: number; symbol: string; coingeckoId: string }
> = PaymentTokenMetadata as Record<
  PaymentToken,
  { chain: string; decimals: number; symbol: string; coingeckoId: string }
>

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

export class RouteRequiredError extends Error {
  readonly action: UploadRedirectAction
  readonly token: PaymentToken
  readonly chain: string

  constructor(
    action: UploadRedirectAction,
    token: PaymentToken,
    chain: string,
  ) {
    super(`Route required: ${action} for ${token} on ${chain}`)
    this.name = "RouteRequiredError"
    this.action = action
    this.token = token
    this.chain = chain
  }
}

function isIrysUnsupportedTokenError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "")
  return /unknown\/?unsupported token|unsupported token|invalid token/i.test(
    message,
  )
}

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
        `${COINGECKO_API_URL}/simple/price?ids=${ids}&vs_currencies=usd`,
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
    paymentChain?: string,
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

    const tokenConfig = TOKEN_CONFIG[token]
    const sourceChain = paymentChain || tokenConfig.chain
    const irysToken = getIrysFundingToken(sourceChain, token)

    if (irysToken) {
      try {
        const { irysService } = await import("@/lib/storage")
        const atomicPrice = await irysService.getPrice(dataSize, irysToken)
        const tokenAmount = atomicPrice / 10 ** tokenConfig.decimals

        return {
          arAmount: arFee.ar,
          tokenAmount,
          formatted: `${tokenAmount.toFixed(6)} ${token}`,
        }
      } catch (error) {
        if (isIrysUnsupportedTokenError(error)) {
          const redirectAction = resolveUploadRedirectAction(sourceChain, token)
          throw new RouteRequiredError(redirectAction, token, sourceChain)
        }
        throw new Error(
          `Failed to estimate ${token} fee on ${irysToken}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    const redirectAction = resolveUploadRedirectAction(sourceChain, token)
    throw new RouteRequiredError(redirectAction, token, sourceChain)
  }

  /**
   * Execute payment to cover the upload fee
   * Returns a status indicating the payment result and method used
   */
  async executePayment(params: {
    fromToken: PaymentToken
    amountInAR: number
    paymentAccount: PaymentAccount
    walletKey: any
    signer?: any // Ethers Signer for EVM chains
    silent?: boolean
    onProgress?: (progress: {
      stage: string
      percent?: number
      message?: string
    }) => void
    fileMetadata?: { name: string; size: number; type?: string }
    intentId?: string // Optional existing intent to resume
  }): Promise<
    | "PAID_NATIVE"
    | "PAID_IRYS"
    | "REQUIRE_SWAP"
    | "REQUIRE_BRIDGE"
    | "PAYMENT_FAILED"
    | "SILENT_STILL_PENDING"
  > {
    const sourceChain = params.paymentAccount.chain
    const { onProgress, silent } = params

    // 1. Resolve or Create Intent
    let intent: PaymentIntent | null = null
    if (params.intentId) {
      intent = await PaymentRepository.getIntent(params.intentId)
    }

    // TIER 1: Native AR
    if (params.fromToken === "AR" && sourceChain === Chains.ARWEAVE) {
      console.log("Using native Arweave payment channel.")
      return "PAID_NATIVE"
    }

    // TIER 2: Irys Rapid Payment (Direct Funding)
    const irysToken = getIrysFundingToken(sourceChain, params.fromToken)

    if (irysToken) {
      console.log(`Executing rapid Irys funding with ${params.fromToken}...`)
      if (onProgress)
        onProgress({
          stage: "payment",
          message: `Funding Irys with ${params.fromToken}...`,
        })

      try {
        const { irysService } = await import("@/lib/storage")
        const { config } = await import("@/lib/config")

        if (sourceChain === Chains.ETHEREUM && !params.signer) {
          console.error("Irys payment requires EVM signer for ethereum source")
          return "PAYMENT_FAILED"
        }

        const irys = await irysService.getIrysInstance({
          token: irysToken,
          wallet:
            sourceChain === Chains.ETHEREUM ? params.signer : params.walletKey,
          rpcUrl:
            sourceChain === Chains.ETHEREUM
              ? config.ethereumRpcUrl
              : config.solanaRpcUrl,
        })

        const price = await irysService.getPrice(
          params.fileMetadata?.size || 1024 * 1024,
          irysToken,
        )
        await irysService.fund(price, irys)

        console.log("Irys rapid funding successful")
        if (params.intentId)
          await PaymentRepository.setStatus(params.intentId, "COMPLETED")
        return "PAID_IRYS"
      } catch (error) {
        if (isIrysUnsupportedTokenError(error)) {
          const redirectAction = resolveUploadRedirectAction(
            sourceChain,
            params.fromToken,
          )
          return redirectAction === "swap" ? "REQUIRE_SWAP" : "REQUIRE_BRIDGE"
        }
        console.error("Irys rapid payment failed:", error)
        return "PAYMENT_FAILED"
      }
    }

    // TIER 3: Silent or Redirected Exchange (Swap/Bridge)
    const { MULTI_HOP_SWAPPER_ADDRESS } =
      await import("@/lib/contracts/addresses")
    const router = new ExchangeRouter({
      rpcUrls: {
        ETHEREUM: config.ethereumRpcUrl,
        SOLANA: config.solanaRpcUrl,
      },
      ethereumContractAddress: MULTI_HOP_SWAPPER_ADDRESS,
      solanaProgramId: config.solanaProgramId,
    })

    const route = await router.getRoute({
      fromChain: sourceChain,
      fromToken: params.fromToken,
      toChain: sourceChain === Chains.SOLANA ? Chains.SOLANA : Chains.ETHEREUM, // Default target
      toToken: sourceChain === Chains.SOLANA ? "SOL" : "ETH", // Default target for Irys
      fromAmount: "0.1", // TODO: Use actual estimate
      recipient: params.paymentAccount.address,
    })

    if (!route) {
      console.error("No valid exchange route found")
      return "PAYMENT_FAILED"
    }

    // Create persistent intent if not exists
    if (!intent && params.fileMetadata) {
      intent = await PaymentRepository.createIntent({
        fromChain: sourceChain,
        fromToken: params.fromToken,
        toToken: route.toToken,
        arAddress: params.paymentAccount.address,
        status: "INITIATED",
        paymentType: route.type as any,
        targetBalanceType: "IRYS",
        fileMetadata: params.fileMetadata,
      })
    }

    if (!silent) {
      return route.type === "SWAP" ? "REQUIRE_SWAP" : "REQUIRE_BRIDGE"
    }

    // SILENT EXECUTION
    try {
      if (onProgress) {
        onProgress({
          stage: "exchange",
          message: `Executing ${route.type.toLowerCase()} (${route.provider}). Est. time: ${Math.round((route.estimatedTime || 0) / 60)}m`,
        })
      }

      if (route.type === "SWAP") {
        // Handle direct swap
        // Note: Implementation of executeSwap needs signer/walletKey properly
        // This is a placeholder for the actual SDK call which we'll refine
        await PaymentRepository.updateIntent(intent!.id, { status: "PENDING" })

        // After swap, we might need to trigger Irys Fund
        // For now, return REQUIRE_SWAP/BRIDGE as fallback if we can't do it fully silent yet
        // but we'll come back to fix this in the next iteration
        return "REQUIRE_SWAP"
      } else {
        // Bridge execution
        if (onProgress)
          onProgress({
            stage: "exchange",
            message: "Initiating bridge transaction...",
          })

        const txHash = "0x..." // placeholder from bridgeService.executeBridge
        await PaymentRepository.updateIntent(intent!.id, {
          txHash,
          status: "PENDING",
        })

        return "SILENT_STILL_PENDING"
      }
    } catch (e) {
      console.error("Silent payment execution failed", e)
      if (intent) await PaymentRepository.setStatus(intent.id, "FAILED")
      return "PAYMENT_FAILED"
    }
  }
}

export const paymentService = new PaymentService()
