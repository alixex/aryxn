/**
 * Common supported tokens for default UI hints
 */
export const SUPPORTED_TOKENS = [
  "BTC",
  "ETH",
  "USDT",
  "USDC",
  "SUI",
  "AR",
  "V2EX",
  "SOL",
] as const
export type SupportedToken = (typeof SUPPORTED_TOKENS)[number]
