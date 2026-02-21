/**
 * Solana blockchain utilities
 * Provides wrapper functions for Solana SDK operations
 */

import { Connection, PublicKey } from "@solana/web3.js"

/**
 * Create a Solana connection to an RPC endpoint
 * @param rpcUrl - The RPC endpoint URL
 * @param commitment - Commitment level (default: 'confirmed')
 * @returns Connection instance
 */
export const createSolanaConnection = (
  rpcUrl: string,
  commitment: "processed" | "confirmed" | "finalized" = "confirmed",
) => {
  return new Connection(rpcUrl, commitment)
}

/**
 * Create a Solana PublicKey from an address string
 * @param address - The base58 encoded address
 * @returns PublicKey instance
 */
export const createSolanaPublicKey = (address: string) => {
  return new PublicKey(address)
}

import type { BalanceResult } from "./types"

/**
 * Get SOL balance for a public key
 * @param connection - Solana connection
 * @param publicKey - The public key to query
 * @returns BalanceResult
 */
export const getSolanaBalance = async (
  connection: Connection,
  publicKey: PublicKey,
): Promise<BalanceResult> => {
  try {
    const balance = await connection.getBalance(publicKey)
    const formatted = formatSolanaBalance(BigInt(balance))
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
 * Format lamports to SOL (with 9 decimals)
 * @param lamports - Amount in lamports
 * @param decimals - Number of decimal places to show (default: 9)
 * @returns Formatted SOL amount as string
 */
export const formatSolanaBalance = (
  lamports: bigint,
  decimals: number = 9,
): string => {
  const sol = Number(lamports) / 1e9
  return sol.toFixed(decimals)
}

/**
 * Parse SOL amount to lamports
 * @param sol - SOL amount as string
 * @returns Amount in lamports as bigint
 */
export const parseSolanaAmount = (sol: string): bigint => {
  const amount = parseFloat(sol)
  if (isNaN(amount)) {
    throw new Error("Invalid SOL amount")
  }
  return BigInt(Math.floor(amount * 1e9))
}
