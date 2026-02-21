/**
 * Hook for managing EVM wallets (MetaMask, Rainbow, etc.) via wagmi
 */

import { useState, useEffect } from "react"
import { useAccount, useConnections } from "wagmi"
import type { Connector } from "wagmi"

export interface UseEvmWalletsReturn {
  address: string | null
  isConnected: boolean
  connector: Connector | undefined
  allAddresses: string[]
}

/**
 * Manage EVM wallet connections and collect all connected addresses
 */
export function useEvmWallets(): UseEvmWalletsReturn {
  const {
    address: paymentAddress,
    isConnected: isPaymentConnected,
    connector,
  } = useAccount()
  const connections = useConnections()

  // 所有 EVM 账户地址
  const [allAddresses, setAllAddresses] = useState<string[]>([])
  const [seenAddresses, setSeenAddresses] = useState<Set<string>>(new Set())

  // 获取所有 EVM 账户地址
  useEffect(() => {
    const fetchAllAddresses = async () => {
      if (!isPaymentConnected || !connector) {
        setAllAddresses([])
        return
      }

      const addresses = new Set<string>()

      // 添加当前连接的地址
      if (paymentAddress) {
        addresses.add(paymentAddress)
      }

      // 添加之前见过的地址
      seenAddresses.forEach((addr) => {
        addresses.add(addr)
      })

      // 从所有连接中收集地址
      if (connections && Array.isArray(connections) && connections.length > 0) {
        connections.forEach((conn) => {
          if (
            conn.accounts &&
            Array.isArray(conn.accounts) &&
            conn.accounts.length > 0
          ) {
            conn.accounts.forEach((acc: { address: string }) => {
              if (acc && acc.address) {
                addresses.add(acc.address)
              }
            })
          }
        })
      }

      // 尝试从 provider 获取额外的账户
      try {
        if ("provider" in connector && connector.provider) {
          const provider = connector.provider as {
            request?: (args: { method: string }) => Promise<unknown>
          }
          if (provider && typeof provider.request === "function") {
            const accounts = await provider.request({ method: "eth_accounts" })
            if (accounts && Array.isArray(accounts)) {
              accounts.forEach((addr) => {
                if (addr && typeof addr === "string") {
                  addresses.add(addr)
                }
              })
            }
          }
        }
      } catch (e) {
        console.debug("Failed to fetch all EVM accounts:", e)
      }

      // 更新已见地址集合
      setSeenAddresses((prev) => {
        const newSet = new Set(prev)
        addresses.forEach((addr) => newSet.add(addr))
        return newSet
      })

      setAllAddresses(Array.from(addresses))
    }

    fetchAllAddresses()

    // 监听账户切换事件
    if (connector && "provider" in connector && connector.provider) {
      const provider = connector.provider as {
        on?: (event: string, handler: (accounts: string[]) => void) => void
        removeListener?: (
          event: string,
          handler: (accounts: string[]) => void,
        ) => void
      }
      if (provider && typeof provider.on === "function") {
        const handleAccountsChanged = (accounts: string[]) => {
          console.log("Accounts changed:", accounts)
          setSeenAddresses((prev) => {
            const newSet = new Set(prev)
            if (accounts && Array.isArray(accounts)) {
              accounts.forEach((addr) => {
                if (addr && typeof addr === "string") {
                  newSet.add(addr)
                }
              })
            }
            return newSet
          })
          fetchAllAddresses()
        }

        provider.on("accountsChanged", handleAccountsChanged)

        return () => {
          if (provider && typeof provider.removeListener === "function") {
            provider.removeListener("accountsChanged", handleAccountsChanged)
          }
        }
      }
    }
  }, [
    isPaymentConnected,
    paymentAddress,
    connector,
    connections,
    seenAddresses,
  ])

  return {
    address: paymentAddress ?? null,
    isConnected: isPaymentConnected,
    connector,
    allAddresses,
  }
}
