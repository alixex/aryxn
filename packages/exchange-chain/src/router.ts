import { Chains } from "@aryxn/chain-constants"
import { MultiChainSwapper } from "@aryxn/swap-multichain"
import { LiFiBridgeService } from "@aryxn/cross-chain"
import { getEthereumRpcUrl, getSolanaRpcUrl } from "@aryxn/query-chain"
import type { ExchangeRequest, ExchangeRoute, ExchangeConfig } from "./types"

export class ExchangeRouter {
  private swapper: MultiChainSwapper
  private bridge: LiFiBridgeService
  private config: ExchangeConfig

  constructor(config: ExchangeConfig) {
    this.config = config
    this.swapper = new MultiChainSwapper({
      ethereumRpcUrl: config.rpcUrls?.ETHEREUM || getEthereumRpcUrl(),
      solanaRpcUrl: config.rpcUrls?.SOLANA || getSolanaRpcUrl(),
      ethereumContractAddress: config.ethereumContractAddress,
      solanaProgramId: config.solanaProgramId,
    })
    this.bridge = new LiFiBridgeService()
  }

  private resolveTokenAddress(chain: string, symbolOrAddress: string): string {
    if (
      symbolOrAddress.startsWith("0x") ||
      (chain === Chains.SOLANA && symbolOrAddress.length > 30) ||
      symbolOrAddress === "native"
    ) {
      return symbolOrAddress
    }

    // Resolve from dynamic token mappings if provided
    const mapping =
      this.config.tokenMappings?.[chain]?.[symbolOrAddress.toUpperCase()]
    return mapping || symbolOrAddress
  }

  /**
   * Determine the best route for an exchange request
   */
  async getRoute(request: ExchangeRequest): Promise<ExchangeRoute | null> {
    // Validate if chains are supported if provided in config
    if (this.config.supportedChains) {
      if (!this.config.supportedChains.includes(request.fromChain)) return null
      if (!this.config.supportedChains.includes(request.toChain)) return null
    }

    const isBridge = this.isBridgeRequired(request)

    if (isBridge) {
      return this.getBridgeRoute(request)
    } else {
      return this.getSwapRoute(request)
    }
  }

  private isBridgeRequired(request: ExchangeRequest): boolean {
    if (request.fromChain !== request.toChain) return true

    // If bridgedChains are explicitly configured, use them
    if (this.config.bridgedChains) {
      return this.config.bridgedChains.includes(request.fromChain)
    }

    // Fallback to legacy hardcoded logic for safety/seamless transition
    if (
      request.fromChain === Chains.BITCOIN ||
      request.fromChain === Chains.ARWEAVE
    ) {
      return true
    }

    return false
  }

  private async getBridgeRoute(
    request: ExchangeRequest,
  ): Promise<ExchangeRoute | null> {
    const fromToken = this.resolveTokenAddress(
      request.fromChain,
      request.fromToken,
    )
    const toToken = this.resolveTokenAddress(request.toChain, request.toToken)

    const route = await this.bridge.getRouteOptions({
      fromChain: request.fromChain as any,
      fromToken,
      fromAddress: request.recipient || "",
      toChain: request.toChain as any,
      toToken,
      toAddress: request.recipient || "",
      amount: request.fromAmount,
    })

    if (!route || route.length === 0) return null

    const best = route[0]
    return {
      type: "BRIDGE",
      fromChain: request.fromChain,
      toChain: request.toChain,
      fromToken,
      toToken,
      fromAmount: request.fromAmount,
      toAmount: best.toAmount,
      estimatedTime: best.steps.reduce(
        (acc: number, step: any) =>
          acc + (step.estimate.executionDuration || 0),
        0,
      ),
      feePercent:
        Number(best.steps[0]?.estimate.feeCosts?.[0]?.percentage) || 0,
      provider: best.steps[0]?.tool || "Lifi",
      routeData: best,
    }
  }

  private async getSwapRoute(
    request: ExchangeRequest,
  ): Promise<ExchangeRoute | null> {
    const fromToken = this.resolveTokenAddress(
      request.fromChain,
      request.fromToken,
    )
    const toToken = this.resolveTokenAddress(request.toChain, request.toToken)

    // Use MultiChainSwapper for EVM/Solana swaps
    const quote = await this.swapper.getQuote({
      chain: request.fromChain as any,
      inputMint: fromToken,
      outputMint: toToken,
      amount: request.fromAmount,
      slippageBps: (request.slippage || 0.5) * 100,
    })

    return {
      type: "SWAP",
      fromChain: request.fromChain,
      toChain: request.toChain,
      fromToken,
      toToken,
      fromAmount: request.fromAmount,
      toAmount: quote?.outAmount || "0",
      provider: "Aryxn DEX",
      routeData: quote,
    }
  }
}
