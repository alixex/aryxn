import {
  Chains,
  UploadPaymentSupportedChains,
  UploadSelectablePaymentTokens,
  UploadTokenNativeChainBySymbol,
} from "@aryxn/chain-constants"
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
  selectableTokensByAccountChain: {
    [Chains.ARWEAVE]: ["AR"],
    [Chains.ETHEREUM]: ["ETH", "USDC", "USDT"],
    [Chains.SOLANA]: ["SOL", "USDC", "USDT", "V2EX"],
    [Chains.SUI]: ["SUI", "USDC", "USDT"],
  },
  tokenNativeChains: UploadTokenNativeChainBySymbol,
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
  if (token === "ETH" && chain === Chains.ETHEREUM) return Chains.ETHEREUM
  if (token === "SOL" && chain === Chains.SOLANA) return Chains.SOLANA
  if (token === "USDC" && chain === Chains.ETHEREUM) return "usdc-ethereum"
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
