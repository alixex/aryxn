// Global type definitions

import type { Connector } from "wagmi"

// Window extensions for external wallets and browser-specific properties
declare global {
  interface Window {
    arweaveWallet?: {
      getActiveAddress: () => Promise<string>
      connect: (permissions: string[]) => Promise<void>
      disconnect: () => Promise<void>
      sign: (transaction: unknown) => Promise<void>
    }
    solana?: {
      isPhantom?: boolean
      connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{
        publicKey: { toString: () => string }
      }>
      disconnect: () => Promise<void>
      on?: (event: string, handler: (args: any) => void) => void
      removeListener?: (event: string, handler: (args: any) => void) => void
    }
    suiWallet?: {
      requestPermissions: () => Promise<void>
      getAccounts: () => Promise<string[]>
      disconnect: () => Promise<void>
      on?: (event: string, handler: (args: any) => void) => void
      removeListener?: (event: string, handler: (args: any) => void) => void
    }
    // Browser-specific properties for service worker detection
    chrome?: unknown
    netscape?: unknown
  }
}

// Export connector type for reuse
export type WalletConnector = Connector | undefined
