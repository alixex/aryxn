import { useWallet as useProviderWallet } from "@/providers/wallet-provider"

/**
 * Access internal wallet (vault) management.
 * 访问内部钱包（库）管理接口
 *
 * @example
 * const walletManager = useInternal()
 * await walletManager.unlock(password)
 * await walletManager.addWallet(privateKey, alias)
 */
export function useInternal() {
  const ctx = useProviderWallet()
  return ctx.internal
}

export default useInternal
