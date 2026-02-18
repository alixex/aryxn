import { useTranslation } from "@/i18n/config"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Wallet, Coins, RefreshCw } from "lucide-react"
import type { PaymentToken } from "@/lib/payment"
import { TOKEN_CONFIG } from "@/lib/payment"
import { useWallet } from "@/hooks/account-hooks"
import { useEffect, useState, useMemo } from "react"
import { getBalance } from "@/lib/chain"

interface PaymentTokenSelectorProps {
  selectedToken: PaymentToken
  onSelectToken: (token: PaymentToken) => void
}

export function PaymentTokenSelector({
  selectedToken,
  onSelectToken,
}: PaymentTokenSelectorProps) {
  const { t } = useTranslation()
  const wallet = useWallet()
  const [balance, setBalance] = useState<string>("0.00")
  const [lastUpdated, setLastUpdated] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  // Derive initial chain from selectedToken or default to arweave
  const [selectedChain, setSelectedChain] = useState<string>(() => {
    return TOKEN_CONFIG[selectedToken]?.chain || "arweave"
  })

  // Group tokens by chain
  const chainTokens = useMemo(() => {
    const map: Record<string, PaymentToken[]> = {}
    Object.entries(TOKEN_CONFIG).forEach(([token, config]) => {
      if (!map[config.chain]) {
        map[config.chain] = []
      }
      map[config.chain].push(token as PaymentToken)
    })
    return map
  }, [])

  // Available chains
  const chains = [
    { id: "arweave", name: t("chain.arweave", "Arweave Wallet") },
    { id: "ethereum", name: t("chain.ethereum", "Ethereum Wallet") },
    { id: "solana", name: t("chain.solana", "Solana Wallet") },
    { id: "sui", name: t("chain.sui", "Sui Wallet") },
    { id: "bitcoin", name: t("chain.bitcoin", "Bitcoin Wallet") },
  ]

  // Sync state when external prop changes
  useEffect(() => {
    const config = TOKEN_CONFIG[selectedToken]
    if (config && config.chain !== selectedChain) {
      setSelectedChain(config.chain)
    }
  }, [selectedToken])

  const fetchBalance = async () => {
    setIsLoading(true)
    try {
      const config = TOKEN_CONFIG[selectedToken]
      let address: string | undefined

      if (config.chain === "arweave") {
        address = wallet.active.arweave?.address
      } else if (config.chain === "ethereum") {
        address = wallet.active.evm?.address
      } else if (config.chain === "solana") {
        address = wallet.active.solana?.address
      } else if (config.chain === "sui") {
        address = wallet.active.sui?.address
      } else if (config.chain === "bitcoin") {
        // Bitcoin support might be limited in current wallet hook, handle gracefully
        address = undefined
      }

      if (address) {
        const res = await getBalance(config.chain, address)
        setBalance(res.formatted)
      } else {
        setBalance("0.00")
      }

      const now = new Date()
      setLastUpdated(
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      )
    } catch (error) {
      console.error("Failed to fetch balance:", error)
      setBalance("Error")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBalance()
    // Refresh interval
    const interval = setInterval(fetchBalance, 30000)
    return () => clearInterval(interval)
  }, [selectedToken, wallet.active])

  const handleChainChange = (chainId: string) => {
    setSelectedChain(chainId)
    // Auto-select first token of the new chain
    const tokensForChain = chainTokens[chainId]
    if (tokensForChain && tokensForChain.length > 0) {
      onSelectToken(tokensForChain[0])
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Coins className="text-muted-foreground h-4 w-4" />
        <span className="text-foreground text-sm font-semibold">
          {t("upload.paymentMethod") || "支付方式"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Chain Selector */}
        <Select value={selectedChain} onValueChange={handleChainChange}>
          <SelectTrigger className="border-border bg-background h-12 w-full rounded-xl shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-2">
              <Wallet className="text-muted-foreground h-4 w-4" />
              <SelectValue placeholder="Select Wallet" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-xl border shadow-lg">
            {chains.map((chain) => (
              <SelectItem
                key={chain.id}
                value={chain.id}
                className="cursor-pointer rounded-lg"
              >
                {chain.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Token Selector */}
        <Select
          value={selectedToken}
          onValueChange={(val) => onSelectToken(val as PaymentToken)}
        >
          <SelectTrigger className="border-border bg-background h-12 w-full rounded-xl shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-2">
              {/* Small token icon placeholder or just text */}
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-xl border shadow-lg">
            {(chainTokens[selectedChain] || []).map((token) => (
              <SelectItem
                key={token}
                value={token}
                className="cursor-pointer rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="bg-secondary flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold">
                    {token.slice(0, 1)}
                  </div>
                  <span>{token}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Footer: Balance & Last Updated */}
      <div className="flex items-center justify-between px-1">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span>{t("common.balance")}:</span>
          <span className="text-foreground font-mono font-medium">
            {balance} {selectedToken}
          </span>
        </div>

        <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
          {isLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
          <span>
            {t("common.updatedAt", "Updated at")} {lastUpdated}
          </span>
        </div>
      </div>
    </div>
  )
}
