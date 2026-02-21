/**
 * Multi-Chain Utilities
 *
 * Export balance checking, token configuration,
 * and chain-specific utilities.
 */

export type { BalanceResult } from "@aryxn/query-chain"
export { getBalance, getRpcUrlForChain } from "@aryxn/query-chain"
export * from "@aryxn/query-chain"

export type { SolanaTokenInfo } from "./solana-token-config"
export { SOLANA_TOKENS, formatSolanaTokenAmount } from "./solana-token-config"

export type { SuiTokenInfo } from "./sui-token-config"
export { SUI_TOKENS, formatSuiTokenAmount } from "./sui-token-config"
