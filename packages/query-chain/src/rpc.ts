import { RPCs } from "@aryxn/chain-constants"

/**
 * Checks if the code is running in a browser environment.
 */
function isBrowser() {
  return typeof window !== "undefined"
}

/**
 * Helper to get environment variables in a cross-platform way.
 * Supports Vite (import.meta.env) and Node (process.env).
 */
function getEnv(key: string): string | undefined {
  if (typeof import.meta !== "undefined" && (import.meta as any).env) {
    return (import.meta as any).env[key]
  }
  const globalProcess = (globalThis as any).process
  if (globalProcess && globalProcess.env) {
    return globalProcess.env[key]
  }
  return undefined
}

/**
 * Get Ethereum RPC endpoint
 * Uses proxy in browser to avoid CORS issues
 */
export function getEthereumRpcUrl(): string {
  const envUrl = getEnv("VITE_ETHEREUM_RPC_URL")
  if (envUrl) {
    return envUrl
  }

  // In browser, use CORS-friendly proxy
  if (isBrowser()) {
    const origin = window.location.origin
    // Use Vite dev proxy for all environments
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return `${origin}${RPCs.PROXY_EVM}`
    }

    // Use Infura (supports CORS)
    return RPCs.EVM_FALLBACK_RPC
  }

  // Server-side: direct access
  return RPCs.EVM_MAINNET_RPC
}

/**
 * Get Polygon RPC endpoint
 */
export function getPolygonRpcUrl(): string {
  const envUrl = getEnv("VITE_POLYGON_RPC_URL")
  if (envUrl) return envUrl
  return RPCs.POLYGON_RPC
}

/**
 * Get Optimism RPC endpoint
 */
export function getOptimismRpcUrl(): string {
  const envUrl = getEnv("VITE_OPTIMISM_RPC_URL")
  if (envUrl) return envUrl
  return RPCs.OPTIMISM_RPC
}

/**
 * Get Arbitrum RPC endpoint
 */
export function getArbitrumRpcUrl(): string {
  const envUrl = getEnv("VITE_ARBITRUM_RPC_URL")
  if (envUrl) return envUrl
  return RPCs.ARBITRUM_RPC
}

/**
 * Get Solana RPC endpoint
 */
export function getSolanaRpcUrl(): string {
  const envUrl = getEnv("VITE_SOLANA_RPC_URL")
  if (envUrl) return envUrl

  // In browser, use CORS-friendly proxy
  if (isBrowser()) {
    const origin = window.location.origin
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return `${origin}${RPCs.PROXY_SOLANA}`
    }
  }

  return RPCs.SOLANA_ANKR
}

/**
 * Get Sui RPC endpoint
 */
export function getSuiRpcUrl(): string {
  const envUrl = getEnv("VITE_SUI_RPC_URL")
  if (envUrl) return envUrl
  return RPCs.SUI_MAINNET
}

/**
 * Get Base RPC endpoint
 */
export function getBaseRpcUrl(): string {
  const envUrl = getEnv("VITE_BASE_RPC_URL")
  if (envUrl) return envUrl
  return RPCs.BASE_RPC
}

/**
 * Bitcoin API endpoint
 */
export function getBitcoinApiUrl(): string {
  return RPCs.BITCOIN_API
}

/**
 * Map of chain identifiers to their RPC resolution functions
 */
export const RPC_RESOLVERS: Record<string, () => string | undefined> = {
  ethereum: getEthereumRpcUrl,
  evm: getEthereumRpcUrl,
  solana: getSolanaRpcUrl,
  bitcoin: getBitcoinApiUrl,
  btc: getBitcoinApiUrl,
  polygon: getPolygonRpcUrl,
  arbitrum: getArbitrumRpcUrl,
  optimism: getOptimismRpcUrl,
  base: getBaseRpcUrl,
  sui: getSuiRpcUrl,
}

/**
 * Helper to get RPC URL based on chain identifier
 */
export function getRpcUrlForChain(chain: string): string | undefined {
  const resolver = RPC_RESOLVERS[chain.toLowerCase()]
  return resolver ? resolver() : undefined
}
