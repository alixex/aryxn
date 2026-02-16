import "@rainbow-me/rainbowkit/styles.css"
import {
  connectorsForWallets,
  RainbowKitProvider,
  type Locale,
} from "@rainbow-me/rainbowkit"
import { metaMaskWallet, injectedWallet } from "@rainbow-me/rainbowkit/wallets"
import { WagmiProvider, createConfig, http } from "wagmi"
import { mainnet, polygon, optimism, arbitrum } from "wagmi/chains"
import { QueryClientProvider, QueryClient } from "@tanstack/react-query"
import { type ReactNode, useEffect, useState, useMemo } from "react"
import { useTranslation, isChineseLanguage } from "@/i18n/config"
import { WalletProvider } from "@/providers/wallet-provider"
import {
  getEthereumRpcUrl,
  getPolygonRpcUrl,
  getOptimismRpcUrl,
  getArbitrumRpcUrl,
} from "@/lib/chain/rpc-config"

const chains = [mainnet, polygon, optimism, arbitrum] as const

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
  const { i18n, t } = useTranslation()
  const [locale, setLocale] = useState<Locale>("en-US")

  // 使用 useMemo 创建 connectors，当语言改变时重新创建
  const connectors = useMemo(() => {
    return connectorsForWallets(
      [
        {
          groupName: t("wallet.recommendedGroup"),
          wallets: [
            metaMaskWallet,
            injectedWallet, // 支持所有浏览器扩展钱包（包括 Coinbase Wallet）
          ],
        },
      ],
      {
        appName: "Aryxn",
        projectId:
          import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ||
          "00000000000000000000000000000000",
      },
    )
  }, [t])

  // 使用 useMemo 创建 wagmi config - 始终创建，避免 WagmiProvider 无法初始化
  const wagmiConfig = useMemo(() => {
    return createConfig({
      connectors,
      chains,
      transports: {
        [mainnet.id]: http(getEthereumRpcUrl()),
        [polygon.id]: http(getPolygonRpcUrl()),
        [optimism.id]: http(getOptimismRpcUrl()),
        [arbitrum.id]: http(getArbitrumRpcUrl()),
      },
      ssr: false,
      multiInjectedProviderDiscovery: false, // 禁用自动钱包检测以减少启动时的网络请求
    })
  }, [connectors])

  useEffect(() => {
    // Map i18next language to RainbowKit Locale
    const currentLang = isChineseLanguage(i18n.language) ? "zh-CN" : "en-US"
    setLocale(currentLang as Locale)
  }, [i18n.language])

  // 始终渲染 WagmiProvider 和 RainbowKitProvider，确保所有 hooks 可以正常使用
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <RainbowKitProvider locale={locale}>
          <WalletProvider>{children}</WalletProvider>
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  )
}
