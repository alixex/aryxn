/**
 * Unified Balance Dispatcher
 */
import { BalanceResult, BalanceOptions } from "./types"
import { getArweaveBalance } from "./arweave"
import { getBitcoinBalance } from "./bitcoin"
import { getEvmBalance, createEvmProvider } from "./evm"
import {
  getSolanaBalance,
  createSolanaConnection,
  createSolanaPublicKey,
} from "./solana"
import { getSuiBalance, createSuiClientWithUrl } from "./sui"

/**
 * Get balance for any supported chain
 * @param chain - Chain identifier (ethereum, arweave, solana, sui, bitcoin)
 * @param address - Wallet address
 * @param options - Configuration options (rpcUrl is required for most chains)
 */
export async function getBalance(
  chain: string,
  address: string,
  options: BalanceOptions = {},
): Promise<BalanceResult> {
  // Normalize chain name
  const chainId = chain.toLowerCase()

  try {
    switch (chainId) {
      case "ethereum":
      case "evm":
        if (!options.rpcUrl) throw new Error("RPC URL required for Ethereum")
        const provider = createEvmProvider(options.rpcUrl)
        return await getEvmBalance(provider, address, options.tokenAddress)

      case "arweave":
        return await getArweaveBalance(address)

      case "bitcoin":
      case "btc":
        if (!options.rpcUrl) throw new Error("API URL required for Bitcoin")
        return await getBitcoinBalance(address, options.rpcUrl)

      case "solana":
        if (!options.rpcUrl) throw new Error("RPC URL required for Solana")
        const solConnection = createSolanaConnection(options.rpcUrl)
        const pubKey = createSolanaPublicKey(address)
        return await getSolanaBalance(solConnection, pubKey)

      case "sui":
        // For Sui, rpcUrl is optional (defaults to mainnet in createSuiClient if not provided)
        // But here we use createSuiClientWithUrl if provided
        const suiClient = options.rpcUrl
          ? createSuiClientWithUrl(options.rpcUrl)
          : createSuiClientWithUrl("https://fullnode.mainnet.sui.io:443")
        return await getSuiBalance(suiClient, address)

      default:
        return {
          balance: "0",
          formatted: "0",
          symbol: "N/A",
          error: `Unsupported chain: ${chain}`,
        }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      balance: "0",
      formatted: "0",
      symbol: chainId.toUpperCase(),
      error: errorMessage,
    }
  }
}
