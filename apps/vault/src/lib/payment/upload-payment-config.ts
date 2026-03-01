import {
  Chains,
  UploadPaymentSupportedChains,
  UploadSelectablePaymentTokens,
  UploadSelectableTokensByAccountChain,
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
  selectableTokensByAccountChain:
    UploadSelectableTokensByAccountChain as Partial<
      Record<string, PaymentToken[]>
    >,
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
  // Native L1 tokens
  if (token === "ETH" && chain === Chains.ETHEREUM) return Chains.ETHEREUM
  if (token === "SOL" && chain === Chains.SOLANA) return Chains.SOLANA
  if (token === "SUI" && chain === Chains.SUI) return Chains.SUI

  // Native L2 tokens supported directly by Irys
  if (token === "ETH" && chain === Chains.ARBITRUM) return "arbitrum"
  if (token === "ETH" && chain === Chains.OPTIMISM) return "optimism"
  if (token === "ETH" && chain === Chains.BASE) return "base-eth"

  // Stablecoins natively supported by Irys
  if (token === "USDC" && chain === Chains.ETHEREUM) return "usdc-ethereum"
  if (token === "USDC" && chain === Chains.SOLANA) return "usdc-solana"
  if (token === "USDT" && chain === Chains.ETHEREUM) return "usdt-ethereum"
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

  // If the chain is an L2 EVM, we can swap USDC/USDT directly to the local ETH for Irys without bridging!
  if (
    [Chains.ARBITRUM, Chains.BASE, Chains.OPTIMISM, Chains.POLYGON].includes(
      chain as any,
    )
  ) {
    return "swap"
  }

  // If all local swap paths fail, require a cross-chain bridge.
  return "bridge"
}
