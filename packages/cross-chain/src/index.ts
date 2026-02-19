import { MultiChainSwapper } from "@aryxn/swap-multichain"
import type { WalletKey } from "@aryxn/wallet-core"
import { irysService } from "@aryxn/arweave"

// Export new Li.Fi bridge service
export * from "./lifi-bridge-service"
export * from "./address-utils"
export * from "./bridge-status-tracker"
export * from "./bridge-simulation"
export * from "./bridge-recovery"

/**
 * Bridge Provider Interface
 */
export interface BridgeProvider {
  name: string
  getSupportedChains(): string[]
  estimateTime(from: string, to: string): number
}

/**
 * Cross-Chain Bridge Service
 * Handles moving assets from unsupported chains/tokens to fast-payment tokens (ETH, SOL, USDC)
 */
export class BridgeService {
  private swapper: MultiChainSwapper

  constructor(swapper: MultiChainSwapper) {
    this.swapper = swapper
  }

  /**
   * Initiate a cross-chain swap/bridge
   * In a real implementation, this would integrate with Wormhole, Li.Fi, or similar.
   */
  async bridgeAsset(params: {
    fromToken: string
    toToken: string
    amount: string
    userAddress: string
    walletKey: WalletKey
  }): Promise<{ txId: string; estimatedArrival: number }> {
    console.log(
      `Bridging ${params.amount} ${params.fromToken} up to ${params.toToken}...`,
    )

    // Placeholder for actual bridging logic
    return {
      txId: "BRIDGE_TX_" + Math.random().toString(36).slice(2),
      estimatedArrival: Date.now() + 600000, // 10 minutes default
    }
  }

  /**
   * Check if a token requires bridging/swapping before payment
   */
  /**
   * Check if a token requires bridging/swapping before payment
   */
  static async requiresBridge(token: string): Promise<boolean> {
    // Always supported locally
    const nativeSupported = ["AR", "ETH", "SOL", "USDC"]
    if (nativeSupported.includes(token)) return false

    // Check dynamic Irys support
    try {
      const supportedTokens = await irysService.getSupportedTokens()
      // Map input token to Irys expected format if needed
      // For now, check if token symbol (lowercase) is in supported list (which are usually chain names or loose symbols)
      // This is a heuristic.

      const lowerToken = token.toLowerCase()
      // Irys supported tokens are like "ethereum", "solana", "arbitrum", "matic", etc.
      // We might need a mapper or check if our token maps to a known chain that is supported.

      // If the token matches a supported chain name directly (e.g. we passed "ethereum" instead of "ETH" - though usually we pass symbol)
      // let's try to match symbol to chain name for common ones.

      const symbolToChain: Record<string, string> = {
        eth: "ethereum",
        sol: "solana",
        matic: "matic",
        avax: "avalanche",
        bnb: "bnb",
        ftm: "fantom",
        op: "optimism",
        arb: "arbitrum",
      }

      const chainName = symbolToChain[lowerToken] || lowerToken

      if (supportedTokens.includes(chainName)) {
        return false
      }

      return true
    } catch (e) {
      console.warn(
        "Failed to check dynamic bridge support, falling back to static:",
        e,
      )
      return !nativeSupported.includes(token)
    }
  }
}
