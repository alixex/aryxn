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

  // 检查 Solana 连接（静默检查，不触发授权弹窗）
  const checkConnection = useCallback(async () => {
    const solana = window.solana
    if (solana && solana.isPhantom) {
      try {
        // 使用 onlyIfTrusted: true 进行静默检查，不会触发授权弹窗
        const resp = await solana.connect({ onlyIfTrusted: true })
        if (resp?.publicKey) {
          setAddress(resp.publicKey.toString())
          setIsConnected(true)
        }
      } catch {
        // 如果未授权或失败，保持断开状态
        setIsConnected(false)
        setAddress(null)
      }
    } else {
      setIsConnected(false)
      setAddress(null)
    }
  }, [])

  // 连接 Solana
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

  // 断开 Solana
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

  // 监听账户切换事件
  useEffect(() => {
    const solana = window.solana
    if (solana && solana.isPhantom) {
      // Phantom 钱包在账户切换时会触发 accountChanged 事件
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

      // 初始检查连接状态
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
