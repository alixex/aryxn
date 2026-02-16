import { useTranslation } from "@/i18n/config"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Wallet, Coins } from "lucide-react"
import type { PaymentToken } from "@/lib/payment-service"
import { TOKEN_CONFIG } from "@/lib/payment-service"
import { useWallet } from "@/hooks/use-wallet"
import { useEffect, useState } from "react"
import { getBalance } from "@/lib/balance"

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

  const tokens: PaymentToken[] = [
    "AR",
    "ETH",
    "SOL",
    "SUI",
    "BTC",
    "USDC",
    "USDT",
  ]

  useEffect(() => {
    const fetchBalance = async () => {
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
      }

      if (address) {
        const res = await getBalance(config.chain, address)
        setBalance(res.formatted)
      } else {
        setBalance("0.00")
      }
    }

    fetchBalance()
  }, [selectedToken, wallet.active])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Coins className="text-muted-foreground h-4 w-4" />
        <span className="text-foreground text-sm font-semibold">
          {t("upload.paymentMethod") || "支付方式"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={selectedToken}
          onValueChange={(val) => onSelectToken(val as PaymentToken)}
        >
          <SelectTrigger className="border-border bg-background h-12 flex-1 rounded-xl shadow-sm transition-all hover:shadow-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border shadow-lg">
            {tokens.map((token) => (
              <SelectItem key={token} value={token} className="rounded-lg">
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

        <div className="border-border bg-card flex h-12 flex-1 items-center gap-3 rounded-xl border px-3 shadow-sm">
          <div className="bg-secondary flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            <Wallet className="text-foreground h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 truncate">
            <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
              {t("common.balance") || "余额"}
            </div>
            <div className="text-foreground truncate text-sm font-bold">
              {balance} {selectedToken}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
