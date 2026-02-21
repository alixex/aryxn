/**
 * RPC endpoint configuration with support for API keys
 * Uses environment variables with fallback to public endpoints
 *
 * Browser CORS handling:
 * - In browser: use full proxy URL (http://localhost:5173/api/rpc for dev)
 * - Custom endpoints via env vars bypass proxy
 */

import { RPCs } from "@aryxn/chain-constants"

function isBrowser() {
  return typeof window !== "undefined"
}

/**
 * Get Ethereum RPC endpoint
 * Uses proxy in browser to avoid CORS issues
 */
export function getEthereumRpcUrl(): string {
  const envUrl = import.meta.env.VITE_ETHEREUM_RPC_URL
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

    // Use Infura (supports CORS) - more reliable than llamarpc
    return RPCs.EVM_FALLBACK_RPC
  }

  // Server-side: direct access
  return RPCs.EVM_MAINNET_RPC
}

/**
 * Get Polygon RPC endpoint
 */
export function getPolygonRpcUrl(): string {
  const envUrl = import.meta.env.VITE_POLYGON_RPC_URL
  if (envUrl) {
    return envUrl
  }

  return RPCs.POLYGON_RPC
}

/**
 * Get Optimism RPC endpoint
 */
export function getOptimismRpcUrl(): string {
  const envUrl = import.meta.env.VITE_OPTIMISM_RPC_URL
  if (envUrl) {
    return envUrl
  }

  return RPCs.OPTIMISM_RPC
}

/**
 * Get Arbitrum RPC endpoint
 */
export function getArbitrumRpcUrl(): string {
  const envUrl = import.meta.env.VITE_ARBITRUM_RPC_URL
  if (envUrl) {
    return envUrl
  }

  return RPCs.ARBITRUM_RPC
}

/**
 * Get Solana RPC endpoint
 */
export function getSolanaRpcUrl(): string {
  const envUrl = import.meta.env.VITE_SOLANA_RPC_URL
  if (envUrl) {
    return envUrl
  }

  // In browser, use CORS-friendly proxy
  if (isBrowser()) {
    const origin = window.location.origin
    // Use Vite dev proxy for all environments
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
  const envUrl = import.meta.env.VITE_SUI_RPC_URL
  if (envUrl) {
    return envUrl
  }

  return RPCs.SUI_MAINNET
}

/**
 * Get Base RPC endpoint
 */
export function getBaseRpcUrl(): string {
  const envUrl = import.meta.env.VITE_BASE_RPC_URL
  if (envUrl) {
    return envUrl
  }

  return RPCs.BASE_RPC
}

/**
 * Bitcoin API endpoint
 */
export function getBitcoinApiUrl(): string {
  return RPCs.BITCOIN_API
}
