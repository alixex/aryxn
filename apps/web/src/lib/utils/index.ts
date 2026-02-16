/**
 * Utility Functions and Types
 *
 * Export common utilities, helper functions, type definitions,
 * and compression utilities.
 */

export { cn, formatFileSize, shortenedAddress } from "./utils"
export {
  compressData,
  decompressData,
  shouldCompressFile,
  getActualCompressedSize,
  searchArweaveTransactionsNetwork,
  searchAppTransactions,
  type ArweaveSearchResult,
  type SearchOptions,
  SearchCache,
  getSearchCache,
  resetSearchCache,
} from "./compression"

export type {
  ArweaveJWK,
  WalletKey,
  WalletRecord,
  VaultMetadata,
  UploadRecord,
  DecryptedData,
  ActiveAccount,
  Address,
  Hash,
  Abi,
  PublicKey,
  SuiClient,
} from "./types"

export {
  initArweave,
  defaultArweave,
  detectChainAndAddress,
  createWallet,
  createEvmProvider,
  getEvmBalance,
  createEvmWallet,
  createEvmContract,
  formatEther,
  parseEther,
  formatUnits,
  parseUnits,
  MaxUint256,
  createSolanaConnection,
  createSolanaPublicKey,
  getSolanaBalance,
  formatSolanaBalance,
  parseSolanaAmount,
  createSuiClient,
  createSuiClientWithUrl,
  getSuiBalance,
  formatSuiBalance,
  parseSuiAmount,
  getFullnodeUrl,
} from "./types"
