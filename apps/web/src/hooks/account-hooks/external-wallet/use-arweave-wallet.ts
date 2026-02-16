/**
 * Hook for managing Arweave wallet (ArConnect) connection
 */

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { useTranslation } from "@/i18n/config"

export interface UseArweaveWalletReturn {
  address: string | null
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

/**
 * Manage Arweave wallet connection and account switching
 */
export function useArweaveWallet(): UseArweaveWalletReturn {
  const { t } = useTranslation()
  const [address, setAddress] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // 检查 Arweave 连接
  const checkConnection = useCallback(async () => {
    if (window.arweaveWallet) {
      try {
        const addr = await window.arweaveWallet.getActiveAddress()
        setAddress(addr)
        setIsConnected(true)
      } catch {
        setIsConnected(false)
        setAddress(null)
      }
    }
  }, [])

  // 连接 Arweave
  const connect = useCallback(async () => {
    if (!window.arweaveWallet) {
      window.open("https://www.arconnect.io/", "_blank")
      return
    }
    try {
      await window.arweaveWallet.connect([
        "ACCESS_ADDRESS",
        "ACCESS_PUBLIC_KEY",
        "SIGN_TRANSACTION",
        "DISPATCH",
      ])
      await checkConnection()
    } catch (e) {
      console.error("Failed to connect ArConnect:", e)
    }
  }, [checkConnection])

  // 断开 Arweave
  const disconnect = useCallback(async () => {
    if (window.arweaveWallet) {
      await window.arweaveWallet.disconnect()
      setIsConnected(false)
      setAddress(null)
      toast.success(t("wallet.arweaveDisconnected"))
    }
  }, [t])

  // 监听钱包切换事件
  useEffect(() => {
    window.addEventListener("walletSwitch", checkConnection)
    return () => window.removeEventListener("walletSwitch", checkConnection)
  }, [checkConnection])

  return {
    address,
    isConnected,
    connect,
    disconnect,
  }
}
