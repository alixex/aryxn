/**
 * Hook for managing Sui Wallet connection
 */

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { useTranslation } from "@/i18n/config"

export interface UseSuiWalletReturn {
  address: string | null
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

/**
 * Manage Sui wallet connection and account switching
 */
export function useSuiWallet(): UseSuiWalletReturn {
  const { t } = useTranslation()
  const [address, setAddress] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // 检查 Sui 连接（静默检查）
  const checkConnection = useCallback(async () => {
    const suiWallet = window.suiWallet
    if (suiWallet) {
      try {
        const accounts = await suiWallet.getAccounts()
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0])
          setIsConnected(true)
        } else {
          setIsConnected(false)
          setAddress(null)
        }
      } catch {
        setIsConnected(false)
        setAddress(null)
      }
    } else {
      setIsConnected(false)
      setAddress(null)
    }
  }, [])

  // 连接 Sui
  const connect = useCallback(async () => {
    const suiWallet = window.suiWallet
    if (!suiWallet) {
      toast.error(t("wallet.installSuiWallet"), {
        action: {
          label: t("wallet.install"),
          onClick: () =>
            window.open(
              "https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil",
              "_blank",
            ),
        },
      })
      return
    }
    try {
      await suiWallet.requestPermissions()
      const accounts = await suiWallet.getAccounts()
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0])
        setIsConnected(true)
        toast.success(t("wallet.suiConnected"))
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

  // 断开 Sui
  const disconnect = useCallback(async () => {
    const suiWallet = window.suiWallet
    if (suiWallet) {
      try {
        await suiWallet.disconnect()
        setAddress(null)
        setIsConnected(false)
        toast.success(t("wallet.suiDisconnected"))
      } catch (e) {
        console.error("Failed to disconnect Sui:", e)
      }
    }
  }, [t])

  // 监听账户切换事件
  useEffect(() => {
    const suiWallet = window.suiWallet
    if (suiWallet) {
      // Sui Wallet 在账户变化时会触发事件
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0])
          setIsConnected(true)
        } else {
          setAddress(null)
          setIsConnected(false)
        }
      }

      // 标准的事件监听
      if (suiWallet.on) {
        suiWallet.on?.("accountsChanged", handleAccountsChanged)
      }

      // 初始检查连接状态
      checkConnection()

      return () => {
        if (suiWallet.removeListener) {
          suiWallet.removeListener("accountsChanged", handleAccountsChanged)
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
