/**
 * Bitcoin balance utilities
 */
import { BalanceResult } from "./types"

/**
 * Get Bitcoin balance
 * @param address - Bitcoin address
 * @param apiUrl - Blockstream-compatible API URL
 */
export async function getBitcoinBalance(
  address: string,
  apiUrl: string,
): Promise<BalanceResult> {
  try {
    // Determine path based on API provider if needed, but assuming blockstream style
    const response = await fetch(`${apiUrl}/address/${address}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch Bitcoin balance: ${response.statusText}`)
    }

    const data = await response.json()
    // Support common Blockstream/Mempool.space API format
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
