import { irysService } from "@aryxn/arweave"

export * from "./lifi-bridge-service"
export * from "./address-utils"
export * from "./bridge-status-tracker"
export * from "./bridge-simulation"
export * from "./bridge-recovery"

const NATIVE_PAYMENT_TOKENS = new Set(["AR", "ETH", "SOL", "USDC"])

const TOKEN_SYMBOL_TO_IRYS = {
  eth: "ethereum",
  sol: "solana",
  matic: "matic",
  avax: "avalanche",
  bnb: "bnb",
  ftm: "fantom",
  op: "optimism",
  arb: "arbitrum",
} as const

function normalizeTokenToIrysName(token: string): string {
  const lowerToken = token.toLowerCase()
  return TOKEN_SYMBOL_TO_IRYS[lowerToken as keyof typeof TOKEN_SYMBOL_TO_IRYS] || lowerToken
}

export async function requiresBridge(token: string): Promise<boolean> {
  if (NATIVE_PAYMENT_TOKENS.has(token.toUpperCase())) {
    return false
  }

  try {
    const supportedTokens = await irysService.getSupportedTokens()
    const irysToken = normalizeTokenToIrysName(token)
    return !supportedTokens.includes(irysToken)
  } catch (error) {
    console.warn(
      "[cross-chain] Failed to check dynamic bridge support, falling back to static support list:",
      error,
    )
    return !NATIVE_PAYMENT_TOKENS.has(token.toUpperCase())
  }
}
