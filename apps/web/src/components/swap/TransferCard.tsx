import { useState } from "react"
import { Send, AlertTriangle } from "lucide-react"
import { useTranslation } from "@/i18n/config"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SwapTokenAmountInput } from "@/components/swap/SwapTokenAmountInput"
import {
  SUPPORTED_TOKENS,
  getDexTokensByAccountChain,
  type TokenInfo,
} from "@/lib/contracts/token-config"
import { useTransfer } from "@/hooks/swap-hooks/use-transfer"
import { useWallet } from "@/hooks/account-hooks"
import { Chains } from "@aryxn/chain-constants"

type DexSelectableAccount = {
  chain: string
  address: string
  alias?: string
  isExternal: boolean
}

interface TransferCardProps {
  selectedAccount: DexSelectableAccount | null
}

export function TransferCard({ selectedAccount }: TransferCardProps) {
  const { t } = useTranslation()
  const wallet = useWallet()
  const selectedChain = selectedAccount?.chain || wallet.active.evm?.chain
  const chainTokens = getDexTokensByAccountChain(selectedChain)
  const hasActiveEvm = !!wallet.active.evm && selectedChain === Chains.ETHEREUM
  const hasTokenForChain = chainTokens.length > 0
  const { transfer, loading } = useTransfer()

  const [inputToken, setInputToken] = useState<TokenInfo>(chainTokens[0] || SUPPORTED_TOKENS[0])
  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [warning, setWarning] = useState("")
  const tokenOptions = chainTokens.map((token) => ({
    value: token.symbol,
    label: token.symbol,
    badge: token.chain,
  }))

  const handleRecipientChange = (val: string) => {
    setRecipient(val)
    if (val.startsWith("0x") && inputToken.chain !== Chains.ETHEREUM) {
      setWarning("Warning: You are sending non-EVM tokens to an EVM address.")
    } else if (
      !val.startsWith("0x") &&
      inputToken.chain === Chains.ETHEREUM &&
      val.length > 0
    ) {
      setWarning("Warning: Ethereum tokens require a 0x address.")
    } else {
      setWarning("")
    }
  }

  const handleSend = () => {
    transfer(inputToken, recipient, amount)
  }

  return (
    <Card className="glass-premium animate-fade-in-down border-none shadow-2xl transition-all duration-500">
      <CardHeader className="glass-strong animate-fade-in-down border-accent/30 bg-card/60 rounded-t-2xl border-b-2 p-6 shadow-lg">
        <CardTitle className="text-foreground text-lg font-bold">
          {t("dex.transfer", "Send Assets")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {!hasActiveEvm && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
            {t("dex.transferEvmOnly", "Send currently supports Ethereum accounts. Please switch to an Ethereum account.")}
          </div>
        )}
        {hasActiveEvm && !hasTokenForChain && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
            {t("dex.noTokensForChain", "No swap tokens are configured for the selected account chain.")}
          </div>
        )}
        {/* Recipient Input */}
        {hasTokenForChain && (
        <div className="space-y-2">
          <Label className="text-foreground text-sm font-semibold">
            Recipient Address
          </Label>
          <Input
            placeholder="0x..."
            value={recipient}
            onChange={(e) => handleRecipientChange(e.target.value)}
            className="border-border bg-background h-12 rounded-xl font-mono text-sm"
          />
          {warning && (
            <div className="mt-1 flex items-center gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              {warning}
            </div>
          )}
        </div>
        )}

        {/* Amount Input */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-foreground text-sm font-semibold">
              Asset & Amount
            </Label>
            <span className="text-muted-foreground text-xs">Balance: 0.00</span>
          </div>
          <SwapTokenAmountInput
            tokenValue={inputToken.symbol}
            onTokenChange={(symbol) => {
              const token = chainTokens.find(
                (item) => item.symbol === symbol,
              )
              if (token) setInputToken(token)
            }}
            tokenOptions={tokenOptions}
            amountValue={amount}
            onAmountChange={setAmount}
            amountType="number"
            amountInputMode="decimal"
            amountPlaceholder="0.00"
          />
        </div>

        {/* Send Button */}
        <Button
          className="mt-4 h-14 w-full rounded-xl text-lg font-bold shadow-lg"
          disabled={
            !hasActiveEvm ||
            !recipient ||
            !amount ||
            !hasTokenForChain ||
            parseFloat(amount) <= 0 ||
            loading
          }
          onClick={handleSend}
        >
          <Send className="mr-2 h-5 w-5" />
          {loading
            ? "Sending..."
            : !hasActiveEvm
              ? t("common.noAccount")
              : `Send ${inputToken.symbol}`}
        </Button>
      </CardContent>
    </Card>
  )
}
