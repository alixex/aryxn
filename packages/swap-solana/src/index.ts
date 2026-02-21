import {
  Connection,
  PublicKey,
  SystemProgram,
  AccountMeta,
} from "@solana/web3.js"
import { AnchorProvider, Program, Wallet, Idl, BN } from "@coral-xyz/anchor"
import {
  createJupiterApiClient,
  QuoteResponse,
  Instruction,
  AccountMeta as JupAccountMeta,
} from "@jup-ag/api"
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"

/**
 * Solana Swapper SDK
 * 封装与 universal-router 程序的交互，集成 Jupiter API
 */
export class SolanaSwapper {
  private connection: Connection
  public program: Program<any> | null = null
  private programId: PublicKey
  private jupiterApi: ReturnType<typeof createJupiterApiClient>

  constructor(config: { rpcUrl: string; programId: string }) {
    this.connection = new Connection(config.rpcUrl)
    this.programId = new PublicKey(config.programId)
    this.jupiterApi = createJupiterApiClient()
  }

  /**
   * 设置钱包（必须在调用其他方法前调用）
   */
  setWallet(wallet: Wallet, idl: any) {
    const provider = new AnchorProvider(
      this.connection,
      wallet,
      AnchorProvider.defaultOptions(),
    )
    this.program = new Program(idl as Idl, provider)
  }

  /**
   * 获取 Jupiter 报价
   */
  async getQuote(params: {
    inputMint: string
    outputMint: string
    amount: number
    slippageBps?: number
  }): Promise<QuoteResponse> {
    return await this.jupiterApi.quoteGet({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      slippageBps: params.slippageBps || 50,
    })
  }

  /**
   * 执行交换
   */
  async swap(params: {
    user: PublicKey
    quoteResponse: QuoteResponse
  }): Promise<string> {
    if (!this.program) {
      throw new Error("Wallet not set. Call setWallet() first.")
    }

    // 1. 从 Jupiter 获取所有交换相关的指令
    const instructions = await this.jupiterApi.swapInstructionsPost({
      swapRequest: {
        quoteResponse: params.quoteResponse,
        userPublicKey: params.user.toBase58(),
        wrapAndUnwrapSol: true,
      },
    })

    // 2. 发送 Jupiter 的 Setup 指令（如 Wrap SOL / 创建 ATA），必须独立发送
    //    不能混入 executeSwap，否则链上指令数据解析会失败
    if (
      instructions.setupInstructions &&
      instructions.setupInstructions.length > 0
    ) {
      const { Transaction, VersionedTransaction } =
        await import("@solana/web3.js")
      for (const ix of instructions.setupInstructions) {
        const txIx = {
          programId: new PublicKey(ix.programId),
          keys: ix.accounts.map((acc: JupAccountMeta) => ({
            pubkey: new PublicKey(acc.pubkey),
            isWritable: acc.isWritable,
            isSigner: acc.isSigner,
          })),
          data: Buffer.from(ix.data, "base64"),
        }
        const tx = new Transaction().add(txIx)
        tx.feePayer = params.user
        tx.recentBlockhash = (
          await this.connection.getLatestBlockhash()
        ).blockhash
        await (this.program.provider as any).sendAndConfirm(tx)
      }
    }

    // 3. 准备程序账户
    const inputMint = new PublicKey(params.quoteResponse.inputMint)
    const outputMint = new PublicKey(params.quoteResponse.outputMint)

    const userSourceToken = getAssociatedTokenAddressSync(
      inputMint,
      params.user,
    )
    const userDestinationToken = getAssociatedTokenAddressSync(
      outputMint,
      params.user,
    )

    const [routerState] = PublicKey.findProgramAddressSync(
      [Buffer.from("router_state")],
      this.programId,
    )

    const routerStateAccount = await (
      this.program.account as any
    ).routerState.fetch(routerState)
    const feeRecipient = routerStateAccount.feeRecipient

    const [inputTokenConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_config"), inputMint.toBuffer()],
      this.programId,
    )
    const [outputTokenConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_config"), outputMint.toBuffer()],
      this.programId,
    )

    // 4. 构建核心 Swap 指令的 SwapStep 和 Remaining Accounts
    const swapIx = instructions.swapInstruction
    const ixData = Buffer.from(swapIx.data, "base64")

    const steps = [
      {
        dexId: "jupiter_aggregator",
        dexProgramId: new PublicKey(swapIx.programId),
        dexType: { jupiter: {} },
        instructionData: ixData,
        accountCount: swapIx.accounts.length,
      },
    ]

    const remainingAccounts: AccountMeta[] = swapIx.accounts.map(
      (acc: JupAccountMeta) => ({
        pubkey: new PublicKey(acc.pubkey),
        isWritable: acc.isWritable,
        isSigner: acc.isSigner,
      }),
    )

    // 5. 调用 Universal Router 的 execute_swap
    return await (this.program.methods as any)
      .executeSwap(new BN(params.quoteResponse.inAmount), {
        steps,
        minAmountOut: new BN(params.quoteResponse.otherAmountThreshold),
      })
      .accounts({
        routerState,
        inputTokenConfig,
        outputTokenConfig,
        userSourceToken,
        userDestinationToken,
        feeRecipient,
        user: params.user,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts(remainingAccounts)
      .rpc()
  }

  /**
   * 初始化程序 (管理员用)
   */
  async initialize(
    defaultFeeBps: number,
    feeRecipient: PublicKey,
  ): Promise<string> {
    if (!this.program) throw new Error("Program not initialized")

    const [routerState] = PublicKey.findProgramAddressSync(
      [Buffer.from("router_state")],
      this.programId,
    )

    return await (this.program.methods as any)
      .initialize(defaultFeeBps)
      .accounts({
        routerState,
        authority: this.program.provider.publicKey,
        feeRecipient,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc()
  }
}
