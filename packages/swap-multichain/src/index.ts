import { Wallet } from "@coral-xyz/anchor"
import type { Idl } from "@coral-xyz/anchor"
import type { Signer, ContractTransactionResponse } from "ethers"
import { SolanaSwapper } from "@aryxn/swap-solana"
import { EthereumSwapper, ProtectionLevel } from "@aryxn/swap-ethereum"
import type { QuoteResponse as JupQuoteResponse } from "@jup-ag/api"
import { Chains, SwappableChains } from "@aryxn/chain-constants"

type SwappableChain = (typeof SwappableChains)[number]

/**
 * Multi-chain swap SDK.
 * Unified interface for Ethereum (EVM) and Solana swap operations,
 * delegating to the chain-specific SDKs internally.
 */
export class MultiChainSwapper {
  // Exposed as readonly for testing/inspection; prefer the unified methods.
  readonly ethSwapper: EthereumSwapper
  readonly solSwapper: SolanaSwapper

  constructor(config: {
    ethereumRpcUrl: string
    solanaRpcUrl: string
    ethereumContractAddress: string
    solanaProgramId: string
  }) {
    this.ethSwapper = new EthereumSwapper({
      rpcUrl: config.ethereumRpcUrl,
      contractAddress: config.ethereumContractAddress,
    })
    this.solSwapper = new SolanaSwapper({
      rpcUrl: config.solanaRpcUrl,
      programId: config.solanaProgramId,
    })
  }

  /**
   * Attach a Solana wallet. Must be called before executeSwap() on Solana.
   * Pass the generated IDL (e.g. `import IDL from '../idl/universal_router.json'`).
   */
  setupSolana(wallet: Wallet, idl: Idl): void {
    this.solSwapper.setWallet(wallet, idl)
  }

  /**
   * Fetch a swap quote. Currently only Solana (Jupiter) quotes are supported;
   * EVM quotes are computed on-chain by PathFinder at swap time.
   */
  async getQuote(params: {
    chain: SwappableChain
    inputMint: string // token address for EVM; mint address for Solana
    outputMint: string
    amount: string | number
    slippageBps?: number
  }): Promise<JupQuoteResponse | null> {
    if (params.chain === Chains.SOLANA) {
      return this.solSwapper.getQuote({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: Number(params.amount),
        slippageBps: params.slippageBps,
      })
    }
    // EVM: PathFinder resolves the best route on-chain at swap time.
    return null
  }

  /**
   * Unified swap interface. Delegates to the correct chain SDK.
   *
   * For Ethereum: `params.amountIn` and `params.minAmountOut` must be token
   * amounts in smallest unit (wei / token decimals) as bigint or numeric string.
   * `deadline` is a Unix timestamp in seconds as bigint.
   *
   * NOTE: Native ETH is not supported for EVM swaps — use WETH.
   */
  async executeSwap(params: {
    chain: SwappableChain
    signer: Signer | Wallet
    tokenIn: string
    tokenOut: string
    amountIn: string | bigint
    minAmountOut: string | bigint
    // Chain-specific params
    solana?: {
      quoteResponse: JupQuoteResponse
    }
    ethereum?: {
      /** Unix timestamp in seconds as bigint */
      deadline: bigint
      protection?: ProtectionLevel
    }
  }): Promise<string | ContractTransactionResponse> {
    if (params.chain === Chains.SOLANA) {
      if (!params.solana?.quoteResponse)
        throw new Error("Missing Solana quote response")
      return this.solSwapper.swap({
        user: (params.signer as Wallet).publicKey,
        quoteResponse: params.solana.quoteResponse,
      })
    } else {
      if (!params.ethereum)
        throw new Error("Missing Ethereum specific parameters")
      return this.ethSwapper.swap({
        signer: params.signer as Signer,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: BigInt(params.amountIn),
        minAmountOut: BigInt(params.minAmountOut),
        deadline: params.ethereum.deadline,
        protection: params.ethereum.protection,
      })
    }
  }

  /**
   * Withdraw accumulated protocol fees (admin only).
   *
   * For EVM: calls `EthereumSwapper.withdrawFees()` directly via the public API.
   * For Solana: fees are paid to the recipient in real-time; no withdrawal needed.
   */
  async withdrawFees(params: {
    chain: SwappableChain
    signer: Signer | Wallet
    tokenAddress: string
  }): Promise<ContractTransactionResponse | void> {
    if (params.chain === Chains.ETHEREUM) {
      // Delegates to the public withdrawFees method — no private field access needed.
      return this.ethSwapper.withdrawFees(
        params.signer as Signer,
        params.tokenAddress,
      )
    } else {
      console.log(
        "Solana fees are collected in real-time to the recipient wallet.",
      )
    }
  }
}
