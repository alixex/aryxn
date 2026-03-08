import { QueryClientProvider, QueryClient } from "@tanstack/react-query"
import { type ReactNode, useMemo } from "react"
import { WalletProvider } from "@/providers/wallet-provider"
import { AutoSyncProvider } from "@/providers/auto-sync-provider"

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
      },
    },
  })
}

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => createQueryClient(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <AutoSyncProvider>{children}</AutoSyncProvider>
      </WalletProvider>
    </QueryClientProvider>
  )
}
