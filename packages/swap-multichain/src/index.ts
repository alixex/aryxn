import { PublicKey } from "@solana/web3.js"
import { Wallet } from "@coral-xyz/anchor"
import { Signer, ContractTransactionResponse } from "ethers"
import { SolanaSwapper } from "@aryxn/swap-solana"
import {
  EthereumSwapper,
  SwapStep as EthSwapStep,
  ProtectionLevel,
} from "@aryxn/swap-ethereum"
import { QuoteResponse as JupQuoteResponse } from "@jup-ag/api"

/**
 * 多链交换 SDK
 * 统一管理以太坊和 Solana 的交换操作，利用底层的链特定 SDK
 */
export class MultiChainSwapper {
  public ethSwapper: EthereumSwapper
  public solSwapper: SolanaSwapper

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
   * 初始化后端程序 (需要 IDL)
   */
  async setupSolana(wallet: Wallet, idl: any) {
    this.solSwapper.setWallet(wallet, idl)
  }

  /**
   * 获取报价 (自动检测链)
   */
  async getQuote(params: {
    chain: "ethereum" | "solana"
    inputMint: string // EVM 下为 token address
    outputMint: string
    amount: string | number
    slippageBps?: number
  }) {
    if (params.chain === "solana") {
      return await this.solSwapper.getQuote({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: Number(params.amount),
        slippageBps: params.slippageBps,
      })
    } else {
      // EVM 的报价目前通常由合约或 SDK 层面的 PathFinder 提供
      // 这里简化直接返回
      return null
    }
  }

  /**
   * 统一交换接口
   */
  async executeSwap(params: {
    chain: "ethereum" | "solana"
    signer: Signer | Wallet
    tokenIn: string
    tokenOut: string
    amountIn: string | bigint
    minAmountOut: string | bigint
    // 特定链参数
    solana?: {
      quoteResponse: JupQuoteResponse
    }
    ethereum?: {
      deadline: number
      route: EthSwapStep[]
      protection?: ProtectionLevel
    }
  }): Promise<string | ContractTransactionResponse> {
    if (params.chain === "solana") {
      if (!params.solana?.quoteResponse)
        throw new Error("Missing Solana quote response")
      return await this.solSwapper.swap({
        user: (params.signer as Wallet).publicKey,
        quoteResponse: params.solana.quoteResponse,
      })
    } else {
      if (!params.ethereum)
        throw new Error("Missing Ethereum specific parameters")
      return await this.ethSwapper.swap({
        signer: params.signer as Signer,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: BigInt(params.amountIn),
        minAmountOut: BigInt(params.minAmountOut),
        deadline: params.ethereum.deadline,
        route: params.ethereum.route,
        protection: params.ethereum.protection,
      })
    }
  }

  /**
   * 提现手续费 (仅管理员)
   */
  async withdrawFees(params: {
    chain: "ethereum" | "solana"
    signer: Signer | Wallet
    tokenAddress: string
  }) {
    if (params.chain === "ethereum") {
      // EVM 需要调用 withdrawFees
      const contract = this.ethSwapper["contract"].connect(params.signer)
      return await contract.withdrawFees(params.tokenAddress)
    } else {
      // Solana 目前是实时到账，暂不需要手动 withdraw
      console.log(
        "Solana fees are collected in real-time to the recipient wallet.",
      )
    }
  }
}
