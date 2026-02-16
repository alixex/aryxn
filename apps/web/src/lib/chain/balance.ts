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
} from "@aryxn/wallet-core"
import { arweave } from "./storage"

// RPC endpoints
const ETHEREUM_RPC = "https://eth.llamarpc.com"
const SOLANA_RPC = "https://api.mainnet-beta.solana.com"
const BITCOIN_API = "https://blockstream.info/api"

export interface BalanceResult {
  balance: string
  formatted: string
  symbol: string
  error?: string
}

/**
 * Get balance for Ethereum address
 */
export async function getEthereumBalance(
  address: string,
): Promise<BalanceResult> {
  try {
    const provider = createEvmProvider(ETHEREUM_RPC)
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
    const connection = createSolanaConnection(SOLANA_RPC)
    const publicKey = createSolanaPublicKey(address)
    const balance = await getSolBalance(connection, publicKey)
    const formatted = formatSolanaBalance(balance, 6)
    return {
      balance: balance.toString(),
      formatted,
      symbol: "SOL",
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
    const response = await fetch(`${BITCOIN_API}/address/${address}`)
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
 * Get balance for any chain
 */
export async function getBalance(
  chain: string,
  address: string,
): Promise<BalanceResult> {
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
