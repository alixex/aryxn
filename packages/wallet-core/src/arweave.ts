/**
 * Arweave balance utilities
 */
import Arweave from "arweave"
import type { BalanceResult } from "./types"

/**
 * Get Arweave balance
 * @param address - Arweave address
 * @param config - Optional Arweave config (defaults to arweave.net)
 */
export async function getArweaveBalance(
  address: string,
  config?: { host: string; port: number; protocol: string },
): Promise<BalanceResult> {
  try {
    const arweave = Arweave.init(
      config || {
        host: "arweave.net",
        port: 443,
        protocol: "https",
      },
    )

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
