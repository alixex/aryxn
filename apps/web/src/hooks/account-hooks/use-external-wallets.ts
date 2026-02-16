import { useWallet as useProviderWallet } from "@/providers/wallet-provider"

/**
 * Access external wallet (browser extensions) state and actions.
 * 访问外部钱包（浏览器扩展）状态和操作
 *
 * @example
 * const { external, actions } = useExternalWallets()
 * await actions.connect("ethereum")
 */
export function useExternalWallets() {
  const ctx = useProviderWallet()
  return {
    /** 外部钱包状态 (EVM, ArConnect, Phantom, Sui) */
    external: ctx.external,
    /** 分组的连接/断开操作 */
    actions: ctx.externalActions,
    /** 连接外部钱包 */
    connectExternal: ctx.connectExternal,
    /** 断开外部钱包 */
    disconnectExternal: ctx.disconnectExternal,
  }
}

export default useExternalWallets
