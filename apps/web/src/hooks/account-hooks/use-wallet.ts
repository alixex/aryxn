import { useMemo } from "react"
import { useWallet as useInternalWallet } from "@/providers/wallet-provider"

/**
 * Unified wallet hook - primary entry point for wallet operations.
 * 统一的钱包 hook - 钱包操作的首选入口点
 *
 * 提供对以下资源的访问：
 * - Internal wallet/vault (内部钱包库)
 * - External wallets/extensions (外部钱包扩展)
 * - Active account synthesis (活跃账户综合)
 * - Account helpers (账户辅助函数)
 *
 * @example
 * const wallet = useWallet()
 *
 * // 获取所有账户
 * const allAccounts = wallet.getAllAccounts("ethereum")
 *
 * // 访问活跃账户
 * const activeAccount = wallet.active.evm
 *
 * // 刷新余额
 * await wallet.refreshBalance("ethereum", "0x123...")
 */
export function useWallet() {
  const context = useInternalWallet()

  return useMemo(
    () => ({
      /** 综合活跃账户（优先级：外部钱包 > 内部钱包） */
      active: context.active,

      /** 内部钱包/库管理接口 */
      internal: context.internal,

      /** 外部钱包/扩展状态 */
      external: context.external,

      // ===== Account Helpers (账户辅助函数) =====
      /** 获取指定链的本地账户 */
      getLocalAccounts: (chain: string) => context.getLocalAccounts(chain),
      /** 获取指定链的外部账户 */
      getExternalAccounts: (chain: string) =>
        context.getExternalAccounts(chain),
      /** 获取指定链的所有账户（本地 + 外部） */
      getAllAccounts: (chain: string) => context.getAllAccounts(chain),
      /** 连接外部钱包 */
      connectExternal: (chain: string) => context.connectExternal(chain),
      /** 断开外部钱包连接 */
      disconnectExternal: (chain: string) => context.disconnectExternal(chain),
      /** 刷新账户余额 */
      refreshBalance: (chain: string, address: string) =>
        context.refreshBalance(chain, address),
      /** 获取所有链的账户映射 */
      getAccountsByChain: () => context.getAccountsByChain(),
    }),
    [context],
  )
}

export type UseWalletReturn = ReturnType<typeof useWallet>
