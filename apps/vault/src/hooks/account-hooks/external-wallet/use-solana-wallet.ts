/**
 * Hook for managing Solana wallet (Phantom) connection
 */

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { useTranslation } from "@/i18n/config"

export interface UseSolanaWalletReturn {
  address: string | null
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

/**
 * Manage Solana wallet connection and account switching
 */
export function useSolanaWallet(): UseSolanaWalletReturn {
  const { t } = useTranslation()
  const [address, setAddress] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Check Solana connection silently (no authorization popup).
  const checkConnection = useCallback(async () => {
    const solana = window.solana
    if (solana && solana.isPhantom) {
      try {
        // Use onlyIfTrusted: true for a silent trust check.
        const resp = await solana.connect({ onlyIfTrusted: true })
        if (resp?.publicKey) {
          setAddress(resp.publicKey.toString())
          setIsConnected(true)
        }
      } catch {
        // Keep disconnected when unauthorized or failed.
        setIsConnected(false)
        setAddress(null)
      }
    } else {
      setIsConnected(false)
      setAddress(null)
    }
  }, [])

  // Connect Solana wallet.
  const connect = useCallback(async () => {
    const solana = window.solana
    if (!solana || !solana.isPhantom) {
      toast.error(t("wallet.installPhantom"), {
        action: {
          label: t("wallet.install"),
          onClick: () => window.open("https://phantom.app/", "_blank"),
        },
      })
      return
    }
    try {
      const resp = await solana.connect()
      if (resp?.publicKey) {
        setAddress(resp.publicKey.toString())
        setIsConnected(true)
        toast.success(t("wallet.solanaConnected"))
      }
    } catch (e) {
      const error = e as { code?: number; message?: string }
      if (error.code !== 4001) {
        toast.error(
          t("wallet.connectionFailed", {
            message: error.message || t("wallet.unknownError"),
          }),
        )
      }
    }
  }, [t])

  // Disconnect Solana wallet.
  const disconnect = useCallback(async () => {
    const solana = window.solana
    if (solana) {
      try {
        await solana.disconnect()
        setAddress(null)
        setIsConnected(false)
        toast.success(t("wallet.solanaDisconnected"))
      } catch (e) {
        console.error("Failed to disconnect Solana:", e)
      }
    }
  }, [t])

  // Listen for account switch events.
  useEffect(() => {
    const solana = window.solana
    if (solana && solana.isPhantom) {
      // Phantom emits accountChanged when the active account changes.
      const handleAccountChanged = (publicKey: any) => {
        if (publicKey) {
          setAddress(publicKey.toString())
          setIsConnected(true)
        } else {
          setAddress(null)
          setIsConnected(false)
        }
      }

      solana.on?.("accountChanged", handleAccountChanged)

      // Initial connection state check.
      checkConnection()

      return () => {
        if (solana.removeListener) {
          solana.removeListener("accountChanged", handleAccountChanged)
        }
      }
    }
  }, [checkConnection])

  return {
    address,
    isConnected,
    connect,
    disconnect,
  }
}
