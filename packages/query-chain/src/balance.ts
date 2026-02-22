import {
  getBalance as getCoreBalance,
  type BalanceResult,
} from "@aryxn/wallet-core"
import { getRpcUrlForChain } from "./rpc"

export type { BalanceResult }

/**
 * Get balance for any supported chain.
 * Automatically resolves the correct RPC URL if not provided.
 */
export async function getBalance(
  chain: string,
  address: string,
  options?: { tokenAddress?: string; forceRefresh?: boolean },
): Promise<BalanceResult> {
  const rpcUrl = getRpcUrlForChain(chain)

  return await getCoreBalance(chain, address, {
    rpcUrl,
    ...options,
  })
}
