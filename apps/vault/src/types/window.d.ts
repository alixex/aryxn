// 扩展 window 对象以支持 solana 和 suiWallet
import type { PublicKey } from "@solana/web3.js"

interface SolanaProvider {
  isPhantom?: boolean
  connect: (options?: {
    onlyIfTrusted?: boolean
  }) => Promise<{ publicKey: PublicKey }>
  disconnect: () => Promise<void>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void
}

interface SuiWalletProvider {
  getAccounts: () => Promise<string[]>
  requestPermissions: () => Promise<void>
  disconnect: () => Promise<void>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void
}

declare global {
  interface Window {
    solana?: SolanaProvider
    suiWallet?: SuiWalletProvider
  }
}
