/**
 * Sui blockchain utilities
 * Provides wrapper functions for Sui SDK operations
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client"

/**
 * Create a Sui client
 * @param network - Network to connect to ('mainnet', 'testnet', 'devnet', 'localnet')
 * @returns SuiClient instance
 */
export const createSuiClient = (
  network: "mainnet" | "testnet" | "devnet" | "localnet" = "mainnet",
) => {
  const url = getFullnodeUrl(network)
  return new SuiClient({ url })
}

/**
 * Create a Sui client with custom RPC URL
 * @param rpcUrl - Custom RPC endpoint URL
 * @returns SuiClient instance
 */
export const createSuiClientWithUrl = (rpcUrl: string) => {
  return new SuiClient({ url: rpcUrl })
}

import { BalanceResult } from "./types"

/**
 * Get SUI balance for an address
 * @param client - Sui client
 * @param address - The Sui address to query
 * @returns BalanceResult
 */
export const getSuiBalance = async (
  client: SuiClient,
  address: string,
): Promise<BalanceResult> => {
  try {
    const balance = await client.getBalance({ owner: address })
    const totalBalance = BigInt(balance.totalBalance)
    const formatted = formatSuiBalance(totalBalance)
    return {
      balance: totalBalance.toString(),
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
 * Format MIST to SUI (with 9 decimals)
 * @param mist - Amount in MIST
 * @param decimals - Number of decimal places to show (default: 9)
 * @returns Formatted SUI amount as string
 */
export const formatSuiBalance = (
  mist: bigint,
  decimals: number = 9,
): string => {
  const sui = Number(mist) / 1e9
  return sui.toFixed(decimals)
}

/**
 * Parse SUI amount to MIST
 * @param sui - SUI amount as string
 * @returns Amount in MIST as bigint
 */
export const parseSuiAmount = (sui: string): bigint => {
  const amount = parseFloat(sui)
  if (isNaN(amount)) {
    throw new Error("Invalid SUI amount")
  }
  return BigInt(Math.floor(amount * 1e9))
}

// Re-export commonly used types and functions
export { getFullnodeUrl } from "@mysten/sui/client"
export type { SuiClient } from "@mysten/sui/client"
