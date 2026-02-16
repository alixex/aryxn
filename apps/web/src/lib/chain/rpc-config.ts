/**
 * RPC endpoint configuration with support for API keys
 * Uses environment variables with fallback to public endpoints
 * 
 * Browser CORS handling:
 * - In browser: use full proxy URL (http://localhost:5173/api/rpc for dev)
 * - Custom endpoints via env vars bypass proxy
 */

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

  // In browser, use CORS-friendly proxy or direct call
  if (isBrowser()) {
    // Option 1: Use Vite dev proxy (requires dev server)
    const origin = window.location.origin
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return `${origin}/api/rpc`
    }
    
    // Option 2: Use public CORS proxy for production/preview
    // This service adds CORS headers to RPC requests
    return "https://cors.allorigins.win/raw?url=https://eth.llamarpc.com/"
  }

  return "https://eth.llamarpc.com"
}

/**
 * Get Polygon RPC endpoint
 */
export function getPolygonRpcUrl(): string {
  const envUrl = import.meta.env.VITE_POLYGON_RPC_URL
  if (envUrl) {
    return envUrl
  }

  return "https://polygon-rpc.com"
}

/**
 * Get Optimism RPC endpoint
 */
export function getOptimismRpcUrl(): string {
  const envUrl = import.meta.env.VITE_OPTIMISM_RPC_URL
  if (envUrl) {
    return envUrl
  }

  return "https://mainnet.optimism.io"
}

/**
 * Get Arbitrum RPC endpoint
 */
export function getArbitrumRpcUrl(): string {
  const envUrl = import.meta.env.VITE_ARBITRUM_RPC_URL
  if (envUrl) {
    return envUrl
  }

  return "https://arb1.arbitrum.io/rpc"
}

/**
 * Get Solana RPC endpoint
 */
export function getSolanaRpcUrl(): string {
  const envUrl = import.meta.env.VITE_SOLANA_RPC_URL
  if (envUrl) {
    return envUrl
  }

  return "https://api.mainnet-beta.solana.com"
}

/**
 * Get Sui RPC endpoint
 */
export function getSuiRpcUrl(): string {
  const envUrl = import.meta.env.VITE_SUI_RPC_URL
  if (envUrl) {
    return envUrl
  }

  return "https://rpc.mainnet.sui.io"
}

/**
 * Bitcoin API endpoint
 */
export function getBitcoinApiUrl(): string {
  return "https://blockstream.info/api"
}
