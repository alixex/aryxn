import { ethers, Provider, Signer, ContractTransactionResponse } from "ethers"

/**
 * Ethereum Swapper SDK
 * 以太坊交换 SDK，封装与 UniversalRouter 合约的交互
 */
export class EthereumSwapper {
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
   * @param params 交换参数，包含多步路由
   */
  async swap(params: {
    signer: Signer
    tokenIn: string
    tokenOut: string
    amountIn: bigint
    minAmountOut: bigint
    deadline: number
    route: SwapStep[]
    protection?: number // ProtectionLevel enum
  }): Promise<ContractTransactionResponse> {
    const contractWithSigner = this.contract.connect(params.signer)

    // 1. 先授权代币 (针对 tokenIn)
    const tokenContract = new ethers.Contract(
      params.tokenIn,
      ERC20_ABI,
      params.signer,
    )

    const allowance = await tokenContract.allowance(
      await params.signer.getAddress(),
      this.contractAddress,
    )

    if (allowance < params.amountIn) {
      const approveTx = await tokenContract.approve(
        this.contractAddress,
        ethers.MaxUint256, // 授权最大值以减少未来交易频率
      )
      await approveTx.wait()
    }

    // 2. 准备 SwapParams 结构体
    const swapParams = {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
      minAmountOut: params.minAmountOut,
      recipient: await params.signer.getAddress(),
      deadline: params.deadline,
      protection: params.protection || 0, // 默认 BASIC
    }

    // 3. 执行交换 (注意：合约期望 (SwapParams params, SwapStep[] route))
    // 实际合约接口中路径寻找可能由链下完成并传入
    return await contractWithSigner.swap(swapParams)
  }

  /**
   * 手动执行带有预定义路由的交换
   */
  async swapWithRoute(params: {
    signer: Signer
    swapParams: SwapParams
  }): Promise<ContractTransactionResponse> {
    const contractWithSigner = this.contract.connect(params.signer)
    return await contractWithSigner.swap(params.swapParams)
  }

  /**
   * 获取预估统计信息
   */
  async getStats() {
    return await this.contract.getStats()
  }
}

// ========== 类型定义 ==========

export enum ProtectionLevel {
  BASIC = 0,
  MEDIUM = 1,
  HIGH = 2,
}

export interface SwapStep {
  dexId: number
  tokenOut: string
  pool: string
  data: string // hex string
}

export interface SwapParams {
  tokenIn: string
  tokenOut: string
  amountIn: bigint
  minAmountOut: bigint
  recipient: string
  deadline: number
  protection: ProtectionLevel
}

// ========== ABI 定义 ==========

const UNIVERSAL_ROUTER_ABI = [
  "function swap((address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient, uint256 deadline, uint8 protection) params) external returns (uint256)",
  "function getStats() external view returns (uint256 totalVolume, uint256 totalFees, uint256 lastUpdate, bool paused)",
  "function withdrawFees(address token) external",
  "function setFeeRecipient(address _feeRecipient) external",
  "function setPaused(bool _paused) external",
  "function feeRecipient() external view returns (address)",
]

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]
