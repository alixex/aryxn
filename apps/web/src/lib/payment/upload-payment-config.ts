import { Chains } from "@aryxn/chain-constants"
import type { PaymentToken, UploadRedirectAction } from "./types"

export interface UploadPaymentConfig {
  supportedAccountChains: string[]
  selectableTokens: PaymentToken[]
  tokenNativeChains: Partial<Record<PaymentToken, string>>
}

export const UPLOAD_PAYMENT_CONFIG: UploadPaymentConfig = {
  supportedAccountChains: [
    Chains.SOLANA,
    Chains.ETHEREUM,
    Chains.SUI,
    Chains.ARWEAVE,
  ],
  selectableTokens: ["USDT", "USDC", "ETH", "SOL", "SUI", "AR", "V2EX"],
  tokenNativeChains: {
    AR: Chains.ARWEAVE,
    ETH: Chains.ETHEREUM,
    USDC: Chains.ETHEREUM,
    USDT: Chains.ETHEREUM,
    SOL: Chains.SOLANA,
    SUI: Chains.SUI,
    V2EX: Chains.ETHEREUM,
  },
}

export function getUploadPaymentSupportedChains(): string[] {
  return [...UPLOAD_PAYMENT_CONFIG.supportedAccountChains]
}

export function getUploadSelectableTokens(): PaymentToken[] {
  return [...UPLOAD_PAYMENT_CONFIG.selectableTokens]
}

export function getIrysFundingToken(
  chain: string,
  token: PaymentToken,
): string | null {
  if (token === "ETH" && chain === Chains.ETHEREUM) return Chains.ETHEREUM
  if (token === "SOL" && chain === Chains.SOLANA) return Chains.SOLANA
  if (token === "USDC" && chain === Chains.ETHEREUM) return "usdc-ethereum"
  if (token === "USDC" && chain === Chains.SOLANA) return "usdc-solana"
  return null
}

export function resolveUploadRedirectAction(
  chain: string,
  token: PaymentToken,
): UploadRedirectAction {
  const nativeChain = UPLOAD_PAYMENT_CONFIG.tokenNativeChains[token]
  if (nativeChain && nativeChain === chain) {
    return "swap"
  }
  return "bridge"
}
