export interface ArweaveJWK {
  kty: string
  e: string
  n: string
  d?: string
  p?: string
  q?: string
  dp?: string
  dq?: string
  qi?: string
  [key: string]: unknown
}

export type WalletKey = ArweaveJWK | string

export interface WalletRecord {
  id?: number
  address: string
  encryptedKey: string
  alias: string
  chain: "ethereum" | "arweave" | "solana" | "sui" | "bitcoin" | "other"
  vaultId: string
  createdAt: number
}

export interface VaultMetadata {
  key: string
  value: string
}

export interface UploadRecord {
  id?: number
  txId: string
  fileName: string
  fileHash: string
  fileSize?: number
  mimeType?: string
  storageType: "arweave"
  ownerAddress: string
  encryptionAlgo: string
  encryptionParams: string
  createdAt: number
}

export interface DecryptedData {
  key: string
  mnemonic?: string
}

export interface ActiveAccount {
  address: string
  chain: "arweave" | "solana" | "sui" | "ethereum"
  isExternal: boolean
}

// Re-export common blockchain types from various SDKs
// This allows apps to import types from @aryxn/wallet-core
// instead of directly from individual blockchain SDKs

// Re-export viem types
export type { Address, Hash, Abi } from "viem"

// Re-export Solana types
export type { PublicKey } from "@solana/web3.js"

// Re-export Sui types
export type { SuiClient } from "@mysten/sui/client"
