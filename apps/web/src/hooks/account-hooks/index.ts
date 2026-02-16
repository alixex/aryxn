/**
 * Account Hooks - 统一导出
 * Central export point for all account-related hooks
 */

// Core account management hooks
export { useWallet, type UseWalletReturn } from "./use-wallet"
export { useInternal } from "./use-internal-wallet"
export { useExternalWallets } from "./use-external-wallets"
export { useAccounts, default as useAccountsDefault } from "./useAccounts"

// Re-export from external-wallet subdirectory
export * from "./external-wallet/use-external-wallets"
export * from "./external-wallet/use-evm-wallets"
export * from "./external-wallet/use-arweave-wallet"
export * from "./external-wallet/use-solana-wallet"
export * from "./external-wallet/use-sui-wallet"
