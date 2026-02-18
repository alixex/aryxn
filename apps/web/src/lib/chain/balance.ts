import {
  getBalance as getCoreBalance,
  type BalanceResult,
} from "@aryxn/wallet-core"
import {
  getEthereumRpcUrl,
  getSolanaRpcUrl,
  getBitcoinApiUrl,
} from "./rpc-config"

export type { BalanceResult }

/**
 * Get balance for any chain
 */
export async function getBalance(
  chain: string,
  address: string,
  tokenAddress?: string,
): Promise<BalanceResult> {
  const rpcUrl = getRpcUrlForChain(chain)

  return await getCoreBalance(chain, address, {
    rpcUrl,
    tokenAddress,
  })
}

/**
 * Helper to get RPC URL based on chain
 */
function getRpcUrlForChain(chain: string): string | undefined {
  switch (chain.toLowerCase()) {
    case "ethereum":
    case "evm":
      return getEthereumRpcUrl()
    case "solana":
      return getSolanaRpcUrl()
    case "bitcoin":
    case "btc":
      return getBitcoinApiUrl()
    case "sui":
      // Sui uses default in wallet-core if not provided, or we could add a config here
      return undefined
    case "arweave":
      return undefined // Uses default arweave.net
    default:
      return undefined
  }
}
