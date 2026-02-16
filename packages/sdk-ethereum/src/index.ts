import { ethers, Provider, Signer, ContractTransactionResponse } from "ethers"

/**
 * Ethereum Swapper SDK
 * 以太坊交换 SDK，封装与 MultiHopSwapper 合约的交互
 */
export class EthereumSwapper {
  private provider: Provider
  private contract: any // 使用 any 避免复杂的 Contract 泛型
  private contractAddress: string

  constructor(config: { rpcUrl: string; contractAddress: string }) {
    this.contractAddress = config.contractAddress
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl)
    this.contract = new ethers.Contract(
      config.contractAddress,
      MULTIHOP_SWAPPER_ABI,
      this.provider,
    )
  }

  /**
   * 获取支持的代币列表
   */
  async getSupportedTokens(): Promise<string[]> {
    return await this.contract.getSupportedTokens()
  }

  /**
   * 获取最优路由
   */
  async getOptimalRoute(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
  ): Promise<{ route: string[]; estimatedOut: bigint }> {
    const [route, estimatedOut] = await this.contract.getOptimalRoute(
      tokenIn,
      tokenOut,
      amountIn,
    )
    return { route, estimatedOut }
  }

  /**
   * 执行交换
   */
  async swap(params: {
    signer: Signer
    tokenIn: string
    tokenOut: string
    amountIn: bigint
    minAmountOut: bigint
    path: string[]
  }): Promise<ContractTransactionResponse> {
    const contractWithSigner = this.contract.connect(params.signer)

    // 先授权代币
    const tokenContract = new ethers.Contract(
      params.tokenIn,
      ERC20_ABI,
      params.signer,
    )

    const approveTx = await tokenContract.approve(
      this.contractAddress,
      params.amountIn,
    )
    await approveTx.wait()

    // 执行交换
    return await contractWithSigner.swap(
      params.tokenIn,
      params.tokenOut,
      params.amountIn,
      params.minAmountOut,
      params.path,
    )
  }

  /**
   * 添加支持的代币（仅管理员）
   */
  async addSupportedToken(
    signer: Signer,
    tokenAddress: string,
  ): Promise<ContractTransactionResponse> {
    const contractWithSigner = this.contract.connect(signer)
    return await contractWithSigner.addSupportedToken(tokenAddress)
  }

  /**
   * 移除支持的代币（仅管理员）
   */
  async removeSupportedToken(
    signer: Signer,
    tokenAddress: string,
  ): Promise<ContractTransactionResponse> {
    const contractWithSigner = this.contract.connect(signer)
    return await contractWithSigner.removeSupportedToken(tokenAddress)
  }
}

// ========== ABI 定义 ==========

const MULTIHOP_SWAPPER_ABI = [
  "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address[] calldata path) external returns (uint256)",
  "function getOptimalRoute(address tokenIn, address tokenOut, uint256 amountIn) external returns (address[] memory, uint256)",
  "function getSupportedTokens() external view returns (address[] memory)",
  "function addSupportedToken(address token) external",
  "function removeSupportedToken(address token) external",
  "function withdrawFees(address token) external",
]

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]

// ========== 导出类型 ==========

export interface SwapParams {
  tokenIn: string
  tokenOut: string
  amountIn: bigint
  minAmountOut: bigint
  path: string[]
}

export interface RouteInfo {
  route: string[]
  estimatedOut: bigint
}
