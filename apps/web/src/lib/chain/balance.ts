import {
  createEvmProvider,
  formatEther,
  createSolanaConnection,
  createSolanaPublicKey,
  getSolanaBalance as getSolBalance,
  formatSolanaBalance,
  createSuiClient,
  getSuiBalance as getSuiBal,
  formatSuiBalance,
  createEvmContract,
  formatUnits,
} from "@aryxn/wallet-core"
import { arweave } from "@/lib/storage"
import {
  getEthereumRpcUrl,
  getSolanaRpcUrl,
  getBitcoinApiUrl,
} from "./rpc-config"
import { ERC20_ABI } from "@/lib/contracts/multi-hop-swapper-abi"

export interface BalanceResult {
  balance: string
  formatted: string
  symbol: string
  timestamp?: number
  error?: string
}

export async function getEthereumBalance(
  address: string,
): Promise<BalanceResult> {
  try {
    const provider = createEvmProvider(getEthereumRpcUrl())
    const balance = await provider.getBalance(address)
    const formatted = formatEther(balance)
    return {
      balance: balance.toString(),
      formatted: parseFloat(formatted).toFixed(6),
      symbol: "ETH",
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      balance: "0",
      formatted: "0",
      symbol: "ETH",
      error: errorMessage,
    }
  }
}

/**
 * Get balance for Solana address
 */
export async function getSolanaBalance(
  address: string,
): Promise<BalanceResult> {
  try {
    // Suppress console errors from RPC client in development
    const consoleError = console.error
    console.error = () => {}

    try {
      const connection = createSolanaConnection(getSolanaRpcUrl())
      const publicKey = createSolanaPublicKey(address)
      const balance = await getSolBalance(connection, publicKey)
      const formatted = formatSolanaBalance(balance, 6)

      console.error = consoleError // Restore console.error

      return {
        balance: balance.toString(),
        formatted,
        symbol: "SOL",
      }
    } finally {
      console.error = consoleError // Ensure console.error is always restored
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      balance: "0",
      formatted: "0",
      symbol: "SOL",
      error: errorMessage,
    }
  }
}

/**
 * Get balance for Sui address
 */
export async function getSuiBalance(address: string): Promise<BalanceResult> {
  try {
    const client = createSuiClient("mainnet")
    const balance = await getSuiBal(client, address)
    const formatted = formatSuiBalance(balance, 6)
    return {
      balance: balance.toString(),
      formatted,
      symbol: "SUI",
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      balance: "0",
      formatted: "0",
      symbol: "SUI",
      error: errorMessage,
    }
  }
}

/**
 * Get balance for Arweave address
 */
export async function getArweaveBalance(
  address: string,
): Promise<BalanceResult> {
  try {
    const winston = await arweave.wallets.getBalance(address)
    const ar = arweave.ar.winstonToAr(winston)
    const formatted = parseFloat(ar).toFixed(6)
    return {
      balance: winston,
      formatted,
      symbol: "AR",
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      balance: "0",
      formatted: "0",
      symbol: "AR",
      error: errorMessage,
    }
  }
}

/**
 * Get balance for Bitcoin address
 */
export async function getBitcoinBalance(
  address: string,
): Promise<BalanceResult> {
  try {
    const response = await fetch(`${getBitcoinApiUrl()}/address/${address}`)
    if (!response.ok) {
      throw new Error("Failed to fetch Bitcoin balance")
    }
    const data = await response.json()
    const satoshis = data.chain_stats?.funded_txo_sum || 0
    const spent = data.chain_stats?.spent_txo_sum || 0
    const balance = satoshis - spent
    const formatted = (balance / 1e8).toFixed(8)
    return {
      balance: balance.toString(),
      formatted,
      symbol: "BTC",
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      balance: "0",
      formatted: "0",
      symbol: "BTC",
      error: errorMessage,
    }
  }
}

/**
 * Get balance for ERC20 token
 */
export async function getErc20Balance(
  chain: string,
  tokenAddress: string,
  walletAddress: string,
): Promise<BalanceResult> {
  try {
    // Only Ethereum supported for now for ERC20-style tokens via this helper
    // For other chains, we might need different logic
    if (chain !== "ethereum") {
      throw new Error("ERC20 balance check only supported for Ethereum chain")
    }

    const provider = createEvmProvider(getEthereumRpcUrl())
    const contract = createEvmContract(tokenAddress, ERC20_ABI, provider)

    // Get decimals and balance
    const [decimals, balance] = await Promise.all([
      contract.decimals(),
      contract.balanceOf(walletAddress),
    ])

    const formatted = formatUnits(balance, decimals)
    const symbol = await contract.symbol()

    return {
      balance: balance.toString(),
      formatted: parseFloat(formatted).toFixed(6),
      symbol,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      balance: "0",
      formatted: "0",
      symbol: "ERC20",
      error: errorMessage,
    }
  }
}

/**
 * Get balance for any chain
 */
export async function getBalance(
  chain: string,
  address: string,
  tokenAddress?: string,
): Promise<BalanceResult> {
  // If token address is provided, fetch token balance
  if (tokenAddress && chain === "ethereum") {
    return getErc20Balance(chain, tokenAddress, address)
  }

  // Otherwise fetch native balance
  switch (chain.toLowerCase()) {
    case "ethereum":
      return getEthereumBalance(address)
    case "solana":
      return getSolanaBalance(address)
    case "sui":
      return getSuiBalance(address)
    case "arweave":
      return getArweaveBalance(address)
    case "bitcoin":
      return getBitcoinBalance(address)
    default:
      return {
        balance: "0",
        formatted: "0",
        symbol: "N/A",
        error: "Unsupported chain",
      }
  }
}
