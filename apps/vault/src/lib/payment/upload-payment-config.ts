import {
  Chains,
  UploadPaymentSupportedChains,
  UploadSelectablePaymentTokens,
  UploadSelectableTokensByAccountChain,
  UploadTokenNativeChainBySymbol,
} from "@alixex/chain-constants"
import type { PaymentToken, UploadRedirectAction } from "./types"

export interface UploadPaymentConfig {
  supportedAccountChains: string[]
  selectableTokens: PaymentToken[]
  selectableTokensByAccountChain: Partial<Record<string, PaymentToken[]>>
  tokenNativeChains: Partial<Record<PaymentToken, string>>
}

export const UPLOAD_PAYMENT_CONFIG: UploadPaymentConfig = {
  supportedAccountChains: [...UploadPaymentSupportedChains],
  selectableTokens: [...UploadSelectablePaymentTokens] as PaymentToken[],
  selectableTokensByAccountChain:
    UploadSelectableTokensByAccountChain as Partial<
      Record<string, PaymentToken[]>
    >,
  tokenNativeChains: UploadTokenNativeChainBySymbol as Partial<
    Record<PaymentToken, string>
  >,
}

export function getUploadPaymentSupportedChains(): string[] {
  return [...UPLOAD_PAYMENT_CONFIG.supportedAccountChains]
}

export function getUploadSelectableTokens(): PaymentToken[] {
  return [...UPLOAD_PAYMENT_CONFIG.selectableTokens]
}

export function getUploadSelectableTokensByChain(
  chain?: string,
): PaymentToken[] {
  if (!chain) return getUploadSelectableTokens()

  const tokens = UPLOAD_PAYMENT_CONFIG.selectableTokensByAccountChain[chain]
  if (!tokens || tokens.length === 0) return getUploadSelectableTokens()

  return [...tokens]
}

export function getIrysFundingToken(
  chain: string,
  token: PaymentToken,
): string | null {
  const c = chain.toLowerCase()
  const t = token.toUpperCase()

  // Native L1 tokens
  if (t === "ETH" && c === Chains.ETHEREUM) return Chains.ETHEREUM
  if (t === "SOL" && c === Chains.SOLANA) return Chains.SOLANA
  if (t === "SUI" && c === Chains.SUI) return Chains.SUI
  if (t === "MATIC" && c === Chains.POLYGON) return "matic"
  if (t === "BNB" && c === Chains.BSC) return "bnb"
  if (t === "AVAX" && c === Chains.AVALANCHE) return "avalanche"

  // Native L2 tokens supported directly by Irys
  if (t === "ETH") {
    if (c === Chains.ARBITRUM) return "arbitrum"
    if (c === Chains.OPTIMISM) return "optimism"
    if (c === Chains.BASE) return "base-eth"
    if (c === "linea") return "linea-eth"
    if (c === "scroll") return "scroll-eth"
  }

  // Stablecoins natively supported by Irys
  if (t === "USDC") {
    if (c === Chains.ETHEREUM) return "usdc-ethereum"
    if (c === Chains.SOLANA) return "usdc-solana"
    if (c === Chains.POLYGON) return "usdc-polygon"
  }

  if (t === "USDT") {
    if (c === Chains.ETHEREUM) return "usdt-ethereum"
  }

  if (t === "IRYS" && c === Chains.IRYS) {
    return "irys" // Let's verify this is the right alias
  }

  return null
}

export function resolveUploadRedirectAction(
  chain: string,
  token: PaymentToken,
): UploadRedirectAction {
  // If the selected chain natively matches the token, just swap (if not already the native token).
  const nativeChain = UPLOAD_PAYMENT_CONFIG.tokenNativeChains[token]
  if (nativeChain && nativeChain === chain) {
    return "swap"
  }

  // If the chain is an L2 EVM, we can swap USDC/USDT directly to the local native token for Irys without bridging!
  const evmL2s = [
    Chains.ARBITRUM,
    Chains.BASE,
    Chains.OPTIMISM,
    Chains.POLYGON,
    "bsc",
    "avalanche",
    "linea",
    "scroll",
  ]
  if (evmL2s.includes(chain as any)) {
    return "swap"
  }

  // If all local swap paths fail, require a cross-chain bridge.
  return "bridge"
}
