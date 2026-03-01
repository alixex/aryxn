/**
 * Account Hooks - 统一导出
 * Central export point for all account-related hooks
 */

// Core account management hooks
export { useWallet, type UseWalletReturn } from "./use-wallet"
export { useInternal } from "./use-internal-wallet"
export { useAccounts } from "./useAccounts"
export { formatTimestamp } from "@/lib/utils"

// Aggregation layer (Provider use only)
export {
  useExternalAggregation,
  type UseExternalWalletsReturn,
} from "./external-wallet/use-external-aggregation"

// Individual external wallet hooks
export {
  useEvmWallets,
  type UseEvmWalletsReturn,
} from "./external-wallet/use-evm-wallets"
export {
  useArweaveWallet,
  type UseArweaveWalletReturn,
} from "./external-wallet/use-arweave-wallet"
export {
  useSolanaWallet,
  type UseSolanaWalletReturn,
} from "./external-wallet/use-solana-wallet"
export {
  useSuiWallet,
  type UseSuiWalletReturn,
} from "./external-wallet/use-sui-wallet"
