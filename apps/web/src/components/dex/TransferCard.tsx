import { useState } from "react"
import { Send, AlertTriangle } from "lucide-react"
import { useTranslation } from "@/i18n/config"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SUPPORTED_TOKENS, type TokenInfo } from "@/lib/contracts/token-config"
import { useTransfer } from "@/hooks/dex-hooks/use-transfer"
import { useWallet } from "@/hooks/account-hooks"
import { Chains } from "@aryxn/chain-constants"

export function TransferCard() {
  const { t } = useTranslation()
  const wallet = useWallet()
  const hasActiveEvm = !!wallet.active.evm
  const { transfer, loading } = useTransfer()

  const [inputToken, setInputToken] = useState<TokenInfo>(SUPPORTED_TOKENS[0])
  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [warning, setWarning] = useState("")

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
        {/* Token Selection */}
        <div className="space-y-2">
          <Label className="text-foreground text-sm font-semibold">Asset</Label>
          <Select
            value={inputToken.symbol}
            onValueChange={(symbol) => {
              const token = SUPPORTED_TOKENS.find((t) => t.symbol === symbol)
              if (token) setInputToken(token)
            }}
          >
            <SelectTrigger className="glass-premium hover:bg-accent/10 border-input/50 h-12 font-bold transition-all">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_TOKENS.map((token) => (
                <SelectItem key={token.address} value={token.symbol}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{token.symbol}</span>
                    <span className="text-muted-foreground text-xs uppercase">
                      {token.chain}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Recipient Input */}
        <div className="space-y-2">
          <Label className="text-foreground text-sm font-semibold">
            Recipient Address
          </Label>
          <Input
            placeholder="0x..."
            value={recipient}
            onChange={(e) => handleRecipientChange(e.target.value)}
            className="bg-secondary/20 border-input/50 h-12 font-mono text-sm"
          />
          {warning && (
            <div className="mt-1 flex items-center gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              {warning}
            </div>
          )}
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-foreground text-sm font-semibold">
              Amount
            </Label>
            <span className="text-muted-foreground text-xs">Balance: 0.00</span>
          </div>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-secondary/20 border-input/50 h-12 text-lg font-bold"
          />
        </div>

        {/* Send Button */}
        <Button
          className="mt-4 h-14 w-full rounded-xl text-lg font-bold shadow-lg"
          disabled={
            !hasActiveEvm ||
            !recipient ||
            !amount ||
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
