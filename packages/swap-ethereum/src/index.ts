import {
  ethers,
  Provider,
  Signer,
  Contract,
  ContractTransactionResponse,
} from "ethers"

/**
 * Typed contract interface for UniversalRouter.
 * Extends BaseContract with the exact methods defined in UNIVERSAL_ROUTER_ABI,
 * eliminating the need for `as any` or typechain.
 */
type RouterContract = Contract & {
  getStats(): Promise<{
    totalVolume: bigint
    totalFees: bigint
    lastUpdate: bigint
    paused: boolean
  }>
  swap(params: SwapParams): Promise<ContractTransactionResponse>
  setFeeRate(rate: number): Promise<ContractTransactionResponse>
  withdrawFees(token: string): Promise<ContractTransactionResponse>
  setFeeRecipient(recipient: string): Promise<ContractTransactionResponse>
  setPaused(paused: boolean): Promise<ContractTransactionResponse>
}

/**
 * Ethereum Swapper SDK
 * Wraps interactions with the UniversalRouter EVM contract.
 *
 * NOTE: The UniversalRouter contract only supports ERC-20 tokens.
 * Native ETH is NOT supported — use WETH instead.
 */
export class EthereumSwapper {
  private provider: Provider
  private contract: RouterContract
  private contractAddress: string

  constructor(config: { rpcUrl: string; contractAddress: string }) {
    this.contractAddress = config.contractAddress
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl)
    this.contract = new ethers.Contract(
      config.contractAddress,
      UNIVERSAL_ROUTER_ABI,
      this.provider,
    ) as RouterContract
  }

  /**
   * Execute a token swap via the UniversalRouter contract.
   *
   * @param params Swap parameters
   * @throws Error if tokenIn is native ETH — use WETH instead
   */
  async swap(params: {
    signer: Signer
    tokenIn: string
    tokenOut: string
    amountIn: bigint
    minAmountOut: bigint
    /** Unix timestamp in seconds as bigint to avoid JS number precision loss */
    deadline: bigint
    protection?: ProtectionLevel
    /** If true, only approve the exact amountIn instead of MaxUint256 */
    exactApproval?: boolean
  }): Promise<ContractTransactionResponse> {
    // FIX: The UniversalRouter contract uses IERC20.safeTransferFrom and
    // explicitly rejects address(0) as tokenIn. Native ETH is not supported.
    // Callers must wrap ETH into WETH before swapping.
    const NATIVE_ETH_SENTINELS = [
      "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      ethers.ZeroAddress,
    ]
    if (
      NATIVE_ETH_SENTINELS.some(
        (s) => params.tokenIn.toLowerCase() === s.toLowerCase(),
      )
    ) {
      throw new Error(
        "Native ETH is not supported by UniversalRouter. " +
          "Please wrap ETH to WETH before swapping.",
      )
    }

    const contractWithSigner = this.contract.connect(
      params.signer,
    ) as RouterContract
    const userAddress = await params.signer.getAddress()

    // 1. Handle ERC-20 approval
    const tokenContract = new ethers.Contract(
      params.tokenIn,
      ERC20_ABI,
      params.signer,
    )
    const allowance: bigint = await tokenContract.allowance(
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

    // 2. Build SwapParams struct
    const swapParams: SwapParams = {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
      minAmountOut: params.minAmountOut,
      recipient: userAddress,
      deadline: params.deadline,
      protection: params.protection ?? ProtectionLevel.MEDIUM,
    }

    // 3. Execute swap
    return contractWithSigner.swap(swapParams)
  }

  /**
   * Fetch protocol statistics from the contract.
   *
   * Note: ethers v6 returns a Result object that supports both named-field
   * and index access. We destructure into a plain POJO for clean typing.
   */
  async getStats(): Promise<RouterStats> {
    // ethers v6 returns a Result object — destructure into a plain POJO
    const result = await this.contract.getStats()
    return {
      totalVolume: result.totalVolume,
      totalFees: result.totalFees,
      lastUpdate: result.lastUpdate,
      paused: result.paused,
    }
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
    return (this.contract.connect(signer) as RouterContract).setFeeRate(
      rateInBps,
    )
  }

  /**
   * 提取手续费 (仅 owner 可调用)
   */
  async withdrawFees(
    signer: Signer,
    token: string,
  ): Promise<ContractTransactionResponse> {
    return (this.contract.connect(signer) as RouterContract).withdrawFees(token)
  }

  /**
   * 设置手续费接收地址 (仅 owner 可调用)
   */
  async setFeeRecipient(
    signer: Signer,
    recipient: string,
  ): Promise<ContractTransactionResponse> {
    return (this.contract.connect(signer) as RouterContract).setFeeRecipient(
      recipient,
    )
  }

  /**
   * 暂停/恢复合约 (仅 owner 可调用)
   */
  async setPaused(
    signer: Signer,
    paused: boolean,
  ): Promise<ContractTransactionResponse> {
    return (this.contract.connect(signer) as RouterContract).setPaused(paused)
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

/** Plain-object shape of the on-chain getStats() return value */
export interface RouterStats {
  totalVolume: bigint
  totalFees: bigint
  /** Unix timestamp of last update (seconds) */
  lastUpdate: bigint
  paused: boolean
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
