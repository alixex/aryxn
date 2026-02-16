import { useWallet as useProviderWallet } from "@/providers/wallet-provider"

export function useExternalWallets() {
  const ctx = useProviderWallet()
  return {
    external: ctx.external,
    actions: ctx.externalActions,
    connectExternal: ctx.connectExternal,
    disconnectExternal: ctx.disconnectExternal,
  }
}

export default useExternalWallets
