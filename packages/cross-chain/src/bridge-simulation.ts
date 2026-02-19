import {
  getChains,
  getStepTransaction,
  type Route,
  type LiFiStep,
} from "@lifi/sdk"
import { RPCs } from "@aryxn/chain-constants"
import {
  createEvmProvider,
  createSolanaConnection,
  createSuiClientWithUrl,
} from "@aryxn/wallet-core"
import { VersionedTransaction } from "@solana/web3.js"

export type BridgeSimulationStatus = "PASSED" | "FAILED" | "UNSUPPORTED"

export interface BridgeSimulationResult {
  status: BridgeSimulationStatus
  chainType: "EVM" | "SVM" | "MVM" | "UTXO" | "TVM" | "UNKNOWN"
  error?: string
}

const toUint8ArrayFromBase64 = (base64: string): Uint8Array => {
  const buffer = (
    globalThis as {
      Buffer?: {
        from: (
          input: string,
          encoding: string,
        ) => Uint8Array | ArrayLike<number>
      }
    }
  ).Buffer
  if (buffer) {
    return Uint8Array.from(buffer.from(base64, "base64"))
  }

  const binary = globalThis.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function getRouteTransactionRequest(
  route: Route,
): Promise<LiFiStep> {
  const firstStep = route.steps[0]
  if (!firstStep) {
    throw new Error("Route has no steps")
  }

  return firstStep.transactionRequest
    ? (firstStep as LiFiStep)
    : await getStepTransaction(firstStep)
}

export async function simulateEvm(tx: {
  to?: string
  data?: string
  value?: string | bigint
}): Promise<void> {
  const provider = createEvmProvider(RPCs.EVM_MAINNET_RPC)
  await provider.call({
    to: tx.to as string,
    data: tx.data as string | undefined,
    value: tx.value ? BigInt(tx.value) : undefined,
  })
}

export async function simulateSolana(data: string | string[]): Promise<void> {
  const connection = createSolanaConnection(RPCs.SOLANA_MAINNET)
  const txBase64 = Array.isArray(data) ? data[0] : data
  const bytes = toUint8ArrayFromBase64(txBase64)
  const tx = VersionedTransaction.deserialize(bytes)
  const result = await connection.simulateTransaction(tx)
  if (result.value.err) {
    throw new Error(JSON.stringify(result.value.err))
  }
}

export async function simulateSui(data: unknown): Promise<void> {
  const client = createSuiClientWithUrl(RPCs.SUI_MAINNET)
  const result = await client.dryRunTransactionBlock({
    transactionBlock: data as any,
  })
  if (result.effects?.status?.status !== "success") {
    throw new Error(result.effects?.status?.error || "Sui simulation failed")
  }
}

export async function simulateBridgeRoute(
  route: Route,
): Promise<BridgeSimulationResult> {
  try {
    const step = await getRouteTransactionRequest(route)
    const fromChainId = step.action.fromChainId

    const chains = await getChains()
    const chain = chains.find((item) => item.id === fromChainId)

    const chainType = (chain?.chainType || "UNKNOWN") as
      | "EVM"
      | "SVM"
      | "MVM"
      | "UTXO"
      | "TVM"
      | "UNKNOWN"

    if (chainType === "UTXO" || chainType === "TVM") {
      return { status: "UNSUPPORTED", chainType }
    }

    const txRequest = step.transactionRequest
    if (!txRequest) {
      return {
        status: "FAILED",
        chainType,
        error: "No transaction request found for simulation",
      }
    }

    if (chainType === "EVM") {
      await simulateEvm({
        to: txRequest.to,
        data: txRequest.data,
        value: txRequest.value,
      })
      return { status: "PASSED", chainType }
    }

    if (chainType === "SVM") {
      if (!txRequest.data) {
        return {
          status: "FAILED",
          chainType,
          error: "Missing Solana transaction data",
        }
      }
      await simulateSolana(txRequest.data)
      return { status: "PASSED", chainType }
    }

    if (chainType === "MVM") {
      if (!txRequest.data) {
        return {
          status: "FAILED",
          chainType,
          error: "Missing Sui transaction data",
        }
      }
      await simulateSui(txRequest.data)
      return { status: "PASSED", chainType }
    }

    return { status: "UNSUPPORTED", chainType }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { status: "FAILED", chainType: "UNKNOWN", error: message }
  }
}
