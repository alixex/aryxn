import { useWallet as useProviderWallet } from "@/providers/wallet-provider"

export function useInternal() {
  const ctx = useProviderWallet()
  return ctx.internal
}

export default useInternal
