import { irysService } from "@aryxn/arweave"
import { normalizeTokenToIrysName } from "@aryxn/chain-constants"

const NATIVE_PAYMENT_TOKENS = new Set(["AR", "ETH", "SOL", "USDC"])

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
