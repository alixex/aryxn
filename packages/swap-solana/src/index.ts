import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js"
import type { AccountMeta } from "@solana/web3.js"
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor"
import type { Idl } from "@coral-xyz/anchor"
import { createJupiterApiClient } from "@jup-ag/api"
import type {
  QuoteResponse,
  Instruction as JupInstruction,
  AccountMeta as JupAccountMeta,
} from "@jup-ag/api"
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"
import { Buffer } from "buffer"

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape of the on-chain RouterState account */
interface RouterStateAccount {
  authority: PublicKey
  feeRecipient: PublicKey
  defaultFeeBps: number
  paused: boolean
}

/** A single routing step passed to executeSwap */
interface SwapStep {
  dexId: string
  dexProgramId: PublicKey
  dexType:
    | { jupiter: Record<string, never> }
    | { custom: Record<string, never> }
  instructionData: Buffer
  accountCount: number
}

/** Arguments for the executeSwap instruction */
interface SwapRoute {
  steps: SwapStep[]
  minAmountOut: BN
}

/** IDL-typed program for universal-router */
// The IDL is passed by the caller so we keep it generic here; callers should
// import `UniversalRouter` from the generated types and pass it via setWallet.
type RouterProgram = Program<Idl>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jupAccountToSolana(acc: JupAccountMeta): AccountMeta {
  return {
    pubkey: new PublicKey(acc.pubkey),
    isWritable: acc.isWritable,
    isSigner: acc.isSigner,
  }
}

function jupInstructionToTx(ix: JupInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map(jupAccountToSolana),
    data: Buffer.from(ix.data, "base64"),
  })
}

// ─── SDK ──────────────────────────────────────────────────────────────────────

/**
 * Solana Swapper SDK
 * Wraps universal-router program interactions and integrates Jupiter API.
 */
export class SolanaSwapper {
  private connection: Connection
  private provider: AnchorProvider | null = null
  private program: RouterProgram | null = null
  private programId: PublicKey
  private jupiterApi: ReturnType<typeof createJupiterApiClient>

  constructor(config: { rpcUrl: string; programId: string }) {
    this.connection = new Connection(config.rpcUrl)
    this.programId = new PublicKey(config.programId)
    this.jupiterApi = createJupiterApiClient()
  }

  /**
   * Attach a wallet. Must be called before swap() or initialize().
   * Pass the generated IDL object (e.g. `import IDL from '../idl/universal_router.json'`).
   */
  setWallet(wallet: Wallet, idl: Idl): void {
    this.provider = new AnchorProvider(
      this.connection,
      wallet,
      AnchorProvider.defaultOptions(),
    )
    this.program = new Program(idl, this.provider)
  }

  /** Fetch a Jupiter quote */
  async getQuote(params: {
    inputMint: string
    outputMint: string
    amount: number
    slippageBps?: number
  }): Promise<QuoteResponse> {
    return this.jupiterApi.quoteGet({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      slippageBps: params.slippageBps ?? 50,
    })
  }

  private requireProgram(): RouterProgram {
    if (!this.program || !this.provider) {
      throw new Error("Wallet not set. Call setWallet() first.")
    }
    return this.program
  }

  /**
   * Execute a token swap via the on-chain universal-router.
   * Returns the confirmed transaction signature.
   */
  async swap(params: {
    user: PublicKey
    quoteResponse: QuoteResponse
  }): Promise<string> {
    const program = this.requireProgram()
    const provider = this.provider!

    // 1. Fetch swap instructions from Jupiter
    const jupInstructions = await this.jupiterApi.swapInstructionsPost({
      swapRequest: {
        quoteResponse: params.quoteResponse,
        userPublicKey: params.user.toBase58(),
        wrapAndUnwrapSol: true,
      },
    })

    // 2. Send Jupiter setup instructions (Wrap SOL / create ATAs) as
    //    separate pre-transactions — they cannot be embedded in executeSwap
    //    because the on-chain instruction parser would misread the data.
    if (jupInstructions.setupInstructions.length > 0) {
      const { blockhash, lastValidBlockHeight } =
        await this.connection.getLatestBlockhash()
      for (const ix of jupInstructions.setupInstructions) {
        const tx = new Transaction({
          feePayer: params.user,
          blockhash,
          lastValidBlockHeight,
        }).add(jupInstructionToTx(ix))
        await provider.sendAndConfirm(tx)
      }
    }

    // 3. Derive on-chain accounts
    const inputMint = new PublicKey(params.quoteResponse.inputMint)
    const outputMint = new PublicKey(params.quoteResponse.outputMint)

    const [routerState] = PublicKey.findProgramAddressSync(
      [Buffer.from("router_state")],
      this.programId,
    )

    // Fetch fee recipient from chain.
    // We cast only the account namespace (not the whole program) to the known
    // shape so TypeScript can verify the returned object's structure.
    type RouterStateFetcher = {
      fetch: (pk: PublicKey) => Promise<RouterStateAccount>
    }
    const routerStateNs = program.account as unknown as {
      routerState: RouterStateFetcher
    }
    const routerStateAccount =
      await routerStateNs.routerState.fetch(routerState)
    const feeRecipient: PublicKey = routerStateAccount.feeRecipient

    const userSourceToken = getAssociatedTokenAddressSync(
      inputMint,
      params.user,
    )
    const userDestinationToken = getAssociatedTokenAddressSync(
      outputMint,
      params.user,
    )

    const [inputTokenConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_config"), inputMint.toBuffer()],
      this.programId,
    )
    const [outputTokenConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_config"), outputMint.toBuffer()],
      this.programId,
    )

    // 4. Build the single SwapStep from Jupiter's core swap instruction
    const swapIx = jupInstructions.swapInstruction
    const step: SwapStep = {
      dexId: "jupiter_aggregator",
      dexProgramId: new PublicKey(swapIx.programId),
      dexType: { jupiter: {} },
      instructionData: Buffer.from(swapIx.data, "base64"),
      accountCount: swapIx.accounts.length,
    }

    const remainingAccounts: AccountMeta[] =
      swapIx.accounts.map(jupAccountToSolana)

    const route: SwapRoute = {
      steps: [step],
      minAmountOut: new BN(params.quoteResponse.otherAmountThreshold),
    }

    // 5. Call executeSwap on the universal-router program
    return program.methods
      .executeSwap(new BN(params.quoteResponse.inAmount), route)
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
      })
      .remainingAccounts(remainingAccounts)
      .rpc()
  }

  /**
   * Initialize the router program (admin only).
   */
  async initialize(
    defaultFeeBps: number,
    feeRecipient: PublicKey,
  ): Promise<string> {
    const program = this.requireProgram()

    return program.methods
      .initialize(defaultFeeBps)
      .accounts({
        authority: this.provider!.wallet.publicKey,
        feeRecipient,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
  }
}
