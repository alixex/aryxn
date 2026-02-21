import { ethers, Provider, Signer, ContractTransactionResponse } from "ethers"

/**
 * Ethereum Swapper SDK
 * 以太坊交换 SDK，封装与 UniversalRouter 合约的交互
 */
export class EthereumSwapper {
  public static readonly NATIVE_ETH =
    "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

  private provider: Provider
  private contract: any
  private contractAddress: string

  constructor(config: { rpcUrl: string; contractAddress: string }) {
    this.contractAddress = config.contractAddress
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl)
    this.contract = new ethers.Contract(
      config.contractAddress,
      UNIVERSAL_ROUTER_ABI,
      this.provider,
    )
  }

  /**
   * 执行交换
   * @param params 交换参数
   */
  async swap(params: {
    signer: Signer
    tokenIn: string
    tokenOut: string
    amountIn: bigint
    minAmountOut: bigint
    /** Unix timestamp (seconds). Use bigint to avoid JS number precision loss. */
    deadline: bigint
    protection?: ProtectionLevel
    /** If true, only approve the exact amountIn instead of MaxUint256 */
    exactApproval?: boolean
  }): Promise<ContractTransactionResponse> {
    const contractWithSigner = this.contract.connect(params.signer)
    const userAddress = await params.signer.getAddress()
    const isNativeIn =
      params.tokenIn.toLowerCase() ===
        EthereumSwapper.NATIVE_ETH.toLowerCase() ||
      params.tokenIn === ethers.ZeroAddress

    // 1. 处理授权 (非原生 ETH 且需要授权)
    if (!isNativeIn) {
      const tokenContract = new ethers.Contract(
        params.tokenIn,
        ERC20_ABI,
        params.signer,
      )

      const allowance = await tokenContract.allowance(
        userAddress,
        this.contractAddress,
      )

      if (allowance < params.amountIn) {
        const approveAmount = params.exactApproval
          ? params.amountIn
          : ethers.MaxUint256
        const approveTx = await tokenContract.approve(
          this.contractAddress,
          approveAmount,
        )
        await approveTx.wait()
      }
    }

    // 2. 准备 SwapParams 结构体
    const swapParams = {
      tokenIn: isNativeIn ? ethers.ZeroAddress : params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
      minAmountOut: params.minAmountOut,
      recipient: userAddress,
      deadline: params.deadline,
      protection: params.protection ?? ProtectionLevel.MEDIUM,
    }

    // 3. 执行交换
    const txOptions = isNativeIn ? { value: params.amountIn } : {}
    return await contractWithSigner.swap(swapParams, txOptions)
  }

  /**
   * 获取预估统计信息
   */
  async getStats(): Promise<{
    totalVolume: bigint
    totalFees: bigint
    lastUpdate: bigint
    paused: boolean
  }> {
    return await this.contract.getStats()
  }

  /**
   * 设置费率 (仅 owner 可调用) — L-3
   * @param rateInBps 费率 bps，最大 100 (1%)
   */
  async setFeeRate(
    signer: Signer,
    rateInBps: number,
  ): Promise<ContractTransactionResponse> {
    if (rateInBps > 100)
      throw new Error("Fee rate must not exceed 100 bps (1%)")
    const contractWithSigner = this.contract.connect(signer)
    return await contractWithSigner.setFeeRate(rateInBps)
  }

  /**
   * 提取手续费 (仅 owner 可调用)
   */
  async withdrawFees(
    signer: Signer,
    token: string,
  ): Promise<ContractTransactionResponse> {
    return await this.contract.connect(signer).withdrawFees(token)
  }

  /**
   * 设置手续费接收地址 (仅 owner 可调用)
   */
  async setFeeRecipient(
    signer: Signer,
    recipient: string,
  ): Promise<ContractTransactionResponse> {
    return await this.contract.connect(signer).setFeeRecipient(recipient)
  }

  /**
   * 暂停/恢复合约 (仅 owner 可调用)
   */
  async setPaused(
    signer: Signer,
    paused: boolean,
  ): Promise<ContractTransactionResponse> {
    return await this.contract.connect(signer).setPaused(paused)
  }
}

/**
 * 常用链配置预设
 */
export const CHAIN_CONFIGS = {
  BASE: {
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    CB_BTC: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
  },
  ARBITRUM: {
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  },
  MAINNET: {
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
}

// ========== 类型定义 ==========

export enum ProtectionLevel {
  BASIC = 0,
  MEDIUM = 1,
  HIGH = 2,
}

export interface SwapParams {
  tokenIn: string
  tokenOut: string
  amountIn: bigint
  minAmountOut: bigint
  recipient: string
  /** Unix timestamp in seconds as bigint */
  deadline: bigint
  protection: ProtectionLevel
}

// ========== ABI 定义 ==========

const UNIVERSAL_ROUTER_ABI = [
  // Core swap
  "function swap((address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient, uint256 deadline, uint8 protection) params) external payable returns (uint256)",
  // Read
  "function getStats() external view returns (uint256 totalVolume, uint256 totalFees, uint256 lastUpdate, bool paused)",
  "function feeRecipient() external view returns (address)",
  "function accumulatedFees(address token) external view returns (uint256)",
  // Admin
  "function withdrawFees(address token) external",
  "function setFeeRecipient(address _feeRecipient) external",
  "function setPaused(bool _paused) external",
  "function setFeeRate(uint16 rate) external", // L-3: added after security audit
]

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]
