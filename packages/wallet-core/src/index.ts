export { initArweave, defaultArweave } from "./arweave-init"
export { detectChainAndAddress } from "./detection"
export { createWallet } from "./creation"
export type {
  ArweaveJWK,
  WalletKey,
  WalletRecord,
  VaultMetadata,
  UploadRecord,
  DecryptedData,
  ActiveAccount,
  // Re-exported blockchain SDK types
  Address,
  Hash,
  Abi,
  PublicKey,
  SuiClient,
} from "./types"
export {
  createEvmProvider,
  getEvmBalance,
  createEvmWallet,
  createEvmContract,
  formatEther,
  parseEther,
  formatUnits,
  parseUnits,
  MaxUint256,
} from "./evm"
export {
  createSolanaConnection,
  createSolanaPublicKey,
  getSolanaBalance,
  formatSolanaBalance,
  parseSolanaAmount,
} from "./solana"
// Balance module
export { getBalance } from "./balance"
export { getArweaveBalance } from "./arweave"
export { getBitcoinBalance } from "./bitcoin"

export {
  createSuiClient,
  createSuiClientWithUrl,
  getSuiBalance,
  formatSuiBalance,
  parseSuiAmount,
  getFullnodeUrl,
} from "./sui"

export type { BalanceResult, BalanceOptions } from "./types"
