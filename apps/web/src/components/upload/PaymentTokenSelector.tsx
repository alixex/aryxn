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
import { cn } from "@/lib/utils"
import { TOKEN_ADDRESSES } from "@/lib/contracts/addresses"

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

  // Get all available accounts for the selected chain
  // We use useMemo to avoid re-fetching on every render, but depend on wallet state
  const availableAccounts = useMemo(() => {
    const accounts = wallet.getAccountsByChain()[selectedChain] || []
    return accounts
  }, [wallet, selectedChain])

  // Track selected address. Default to the first available account or active one.
  const [selectedAddress, setSelectedAddress] = useState<string | undefined>()

  // Initialize or update selectedAddress when chain or availableAccounts change
  useEffect(() => {
    if (availableAccounts.length > 0) {
      // Try to keep current selection if valid for new chain (unlikely but safe)
      // or default to the first one (which is usually the active one from getAccountsByChain order if we implemented sorting,
      // but here we just take the first. Ideally we should prefer `wallet.active[chain]?.address`)

      let preferredAddress = availableAccounts[0].address

      // Try to find the "active" account for this chain from wallet.active
      // simple mapping: arweave -> active.arweave, etc.
      let activeForChain: string | undefined
      if (selectedChain === "arweave")
        activeForChain = wallet.active.arweave?.address
      else if (selectedChain === "ethereum")
        activeForChain = wallet.active.evm?.address
      else if (selectedChain === "solana")
        activeForChain = wallet.active.solana?.address
      else if (selectedChain === "sui")
        activeForChain = wallet.active.sui?.address

      if (
        activeForChain &&
        availableAccounts.some((a) => a.address === activeForChain)
      ) {
        preferredAddress = activeForChain
      }

      if (
        selectedAddress !== preferredAddress &&
        !availableAccounts.some((a) => a.address === selectedAddress)
      ) {
        setSelectedAddress(preferredAddress)
      }
    } else {
      setSelectedAddress(undefined)
    }
  }, [selectedChain, availableAccounts, wallet.active])

  // Sync state when external prop changes
  useEffect(() => {
    const config = TOKEN_CONFIG[selectedToken]
    if (config && config.chain !== selectedChain) {
      setSelectedChain(config.chain)
    }
  }, [selectedToken])

  const fetchBalance = async () => {
    if (!selectedAddress) {
      setBalance("0.00")
      return
    }

    setIsLoading(true)
    try {
      const config = TOKEN_CONFIG[selectedToken]

      // Check if there is a contract address for this token
      const tokenAddress = (TOKEN_ADDRESSES as Record<string, string>)[
        selectedToken
      ]

      const res = await getBalance(config.chain, selectedAddress, tokenAddress)
      setBalance(res.formatted)

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
  }, [selectedToken, selectedAddress])

  const handleChainChange = (chainId: string) => {
    setSelectedChain(chainId)
    // Auto-select first token of the new chain
    const tokensForChain = chainTokens[chainId]
    if (tokensForChain && tokensForChain.length > 0) {
      onSelectToken(tokensForChain[0])
    }
  }

  // Formatting helper for address
  const formatAddress = (addr: string) => {
    if (!addr) return ""
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Coins className="text-muted-foreground h-4 w-4" />
        <span className="text-foreground text-sm font-semibold">
          {t("upload.paymentMethod") || "支付方式"}
        </span>
      </div>

      <div className="grid gap-3">
        {/* Chain and Token Selector Row - Always side-by-side on desktop/tablet */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

        {/* Address Selector - Only show if multiple accounts exist for this chain */}
        {availableAccounts.length > 1 && (
          <div className="animate-in fade-in slide-in-from-top-1">
            <Select value={selectedAddress} onValueChange={setSelectedAddress}>
              <SelectTrigger className="border-border bg-card/50 h-10 w-full rounded-lg shadow-sm">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {t("common.usingAccount", "Using Account")}:
                  </span>
                  <span className="font-mono">
                    {selectedAddress
                      ? formatAddress(selectedAddress)
                      : "Select..."}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border shadow-lg">
                {availableAccounts.map((acc) => (
                  <SelectItem
                    key={acc.id || acc.address}
                    value={acc.address}
                    className="cursor-pointer rounded-lg"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          {acc.alias ||
                            (acc.isExternal
                              ? "External Wallet"
                              : "Private Vault")}
                        </span>
                        {acc.isExternal && (
                          <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] text-yellow-500">
                            Ext
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {formatAddress(acc.address)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
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
