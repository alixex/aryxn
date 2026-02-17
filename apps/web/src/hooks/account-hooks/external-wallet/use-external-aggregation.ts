/**
 * Aggregation hook that combines all external wallet hooks
 * This provides a unified interface for accessing all wallet types
 */

import { useArweaveWallet } from "./use-arweave-wallet"
import { useSolanaWallet } from "./use-solana-wallet"
import { useSuiWallet } from "./use-sui-wallet"
import { useEvmWallets } from "./use-evm-wallets"
import { useMemo } from "react"
import type { Connector } from "wagmi"

export interface UseExternalWalletsReturn {
  // Arweave
  arAddress: string | null
  isArConnected: boolean
  connectArweave: () => Promise<void>
  disconnectArweave: () => Promise<void>

  // Solana
  solAddress: string | null
  isSolConnected: boolean
  connectSolana: () => Promise<void>
  disconnectSolana: () => Promise<void>

  // Sui
  suiAddress: string | null
  isSuiConnected: boolean
  connectSui: () => Promise<void>
  disconnectSui: () => Promise<void>

  // EVM
  paymentAddress: string | null
  isPaymentConnected: boolean
  connector: Connector | undefined
  allEVMAddresses: string[]
}

/**
 * Aggregated external wallets hook (Provider use only)
 * Combines Arweave, Solana, Sui, and EVM wallet hooks into a single interface
 */
export function useExternalAggregation(): UseExternalWalletsReturn {
  const arweave = useArweaveWallet()
  const solana = useSolanaWallet()
  const sui = useSuiWallet()
  const evm = useEvmWallets()

  // Memoize the return object to prevent infinite loops in consumers (e.g. useAccounts)
  return useMemo(
    () => ({
      // Arweave
      arAddress: arweave.address,
      isArConnected: arweave.isConnected,
      connectArweave: arweave.connect,
      disconnectArweave: arweave.disconnect,

      // Solana
      solAddress: solana.address,
      isSolConnected: solana.isConnected,
      connectSolana: solana.connect,
      disconnectSolana: solana.disconnect,

      // Sui
      suiAddress: sui.address,
      isSuiConnected: sui.isConnected,
      connectSui: sui.connect,
      disconnectSui: sui.disconnect,

      // EVM
      paymentAddress: evm.address,
      isPaymentConnected: evm.isConnected,
      connector: evm.connector,
      allEVMAddresses: evm.allAddresses,
    }),
    [
      arweave.address,
      arweave.isConnected,
      arweave.connect,
      arweave.disconnect,
      solana.address,
      solana.isConnected,
      solana.connect,
      solana.disconnect,
      sui.address,
      sui.isConnected,
      sui.connect,
      sui.disconnect,
      evm.address,
      evm.isConnected,
      evm.connector,
      evm.allAddresses,
    ],
  )
}
