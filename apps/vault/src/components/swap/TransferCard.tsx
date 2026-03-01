import { useEffect, useState } from "react"
import { Send, AlertTriangle } from "lucide-react"
import { useTranslation } from "@/i18n/config"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SwapTokenAmountInput } from "@/components/swap/SwapTokenAmountInput"
import { ChainIcon } from "@/components/common/ChainIcon"
import {
  SUPPORTED_TOKENS,
  getDexTokensByAccountChain,
  type TokenInfo,
} from "@/lib/contracts/token-config"
import { useTransfer } from "@/hooks/swap-hooks/use-transfer"
import { useBitcoinTransfer } from "@/hooks/swap-hooks/use-bitcoin-transfer"
import { useWallet } from "@/hooks/account-hooks"
import { Chains, ChainIds } from "@aryxn/chain-constants"

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
  const btcMode = selectedChain === Chains.BITCOIN

  const chainTokens = getDexTokensByAccountChain(selectedChain)
  const hasActiveEvm = !!wallet.active.evm && selectedChain === Chains.ETHEREUM
  const hasActiveBitcoin =
    selectedAccount?.chain === Chains.BITCOIN && !selectedAccount.isExternal
  const canTransfer = btcMode ? hasActiveBitcoin : hasActiveEvm
  const hasTokenForChain = chainTokens.length > 0

  const { transfer, loading } = useTransfer()
  const {
    transfer: transferBitcoin,
    loading: btcLoading,
    estimate,
    estimating,
    preview,
    estimateError,
  } = useBitcoinTransfer(selectedAccount)

  const [inputToken, setInputToken] = useState<TokenInfo>(
    chainTokens[0] || SUPPORTED_TOKENS[0],
  )
  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [warning, setWarning] = useState("")

  const tokenOptions = chainTokens.map((token) => ({
    value: token.symbol,
    label: token.symbol,
    badge: String(token.chainId),
    icon: token.icon,
  }))

  const handleRecipientChange = (value: string) => {
    setRecipient(value)

    if (btcMode) {
      setWarning("")
      return
    }

    if (value.startsWith("0x") && inputToken.chainId !== ChainIds.ETHEREUM) {
      setWarning("Warning: You are sending non-EVM tokens to an EVM address.")
    } else if (
      !value.startsWith("0x") &&
      inputToken.chainId === ChainIds.ETHEREUM &&
      value.length > 0
    ) {
      setWarning("Warning: Ethereum tokens require a 0x address.")
    } else {
      setWarning("")
    }
  }

  const handleSend = () => {
    if (btcMode) {
      void transferBitcoin(recipient, amount)
      return
    }

    transfer(inputToken, recipient, amount)
  }

  useEffect(() => {
    if (!btcMode || !canTransfer) return

    if (!recipient || !amount || Number.parseFloat(amount) <= 0) return

    const timer = setTimeout(() => {
      void estimate(recipient, amount)
    }, 500)

    return () => clearTimeout(timer)
  }, [btcMode, canTransfer, recipient, amount, estimate])

  return (
    <Card className="glass-premium animate-fade-in-down border-none shadow-2xl transition-all duration-500">
      <CardHeader className="glass-strong animate-fade-in-down border-accent/30 bg-card/60 rounded-t-2xl border-b-2 p-6 shadow-lg">
        <CardTitle className="flex items-center gap-3 text-lg font-bold">
          <ChainIcon chain={selectedChain} size="sm" />
          <span className="text-foreground">
            {t("dex.transfer", "Send Assets")}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {!canTransfer && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
            {btcMode
              ? t(
                  "dex.transferBitcoinInternalOnly",
                  "Bitcoin send currently supports internal BTC accounts only.",
                )
              : t(
                  "dex.transferEvmOnly",
                  "Send currently supports Ethereum accounts. Please switch to an Ethereum account.",
                )}
          </div>
        )}

        {!btcMode && canTransfer && !hasTokenForChain && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
            {t(
              "dex.noTokensForChain",
              "No swap tokens are configured for the selected account chain.",
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-foreground text-sm font-semibold">
            Recipient Address
          </Label>
          <Input
            placeholder={btcMode ? "bc1..." : "0x..."}
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

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-foreground text-sm font-semibold">
              {btcMode ? "BTC Amount" : "Asset & Amount"}
            </Label>
            <span className="text-muted-foreground text-xs">Balance: 0.00</span>
          </div>

          {btcMode ? (
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00000000"
              inputMode="decimal"
              className="border-border bg-background h-12 rounded-xl text-sm"
            />
          ) : (
            <SwapTokenAmountInput
              tokenValue={inputToken.symbol}
              onTokenChange={(symbol) => {
                const token = chainTokens.find((item) => item.symbol === symbol)
                if (token) setInputToken(token)
              }}
              tokenOptions={tokenOptions}
              amountValue={amount}
              onAmountChange={setAmount}
              amountType="number"
              amountInputMode="decimal"
              amountPlaceholder="0.00"
            />
          )}
        </div>

        {btcMode && estimateError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500">
            {estimateError}
          </div>
        )}

        {btcMode && preview && (
          <div className="border-border bg-card space-y-2 rounded-xl border p-3 text-xs">
            <div className="text-foreground font-semibold">
              {t("dex.transferPreview", "Transfer Preview")}
            </div>
            <div className="text-muted-foreground flex items-center justify-between">
              <span>{t("dex.networkFee", "Network Fee")}</span>
              <span>{(preview.feeSats / 1e8).toFixed(8)} BTC</span>
            </div>
            <div className="text-muted-foreground flex items-center justify-between">
              <span>{t("dex.feeRate", "Fee Rate")}</span>
              <span>{preview.feeRate} sat/vB</span>
            </div>
            <div className="text-muted-foreground flex items-center justify-between">
              <span>{t("dex.virtualSize", "Virtual Size")}</span>
              <span>{preview.vsize} vB</span>
            </div>
            <div className="text-muted-foreground flex items-center justify-between">
              <span>{t("dex.changeAmount", "Change")}</span>
              <span>{(preview.changeSats / 1e8).toFixed(8)} BTC</span>
            </div>
          </div>
        )}

        <Button
          className="mt-4 h-14 w-full rounded-xl text-lg font-bold shadow-lg"
          disabled={
            !canTransfer ||
            !recipient ||
            !amount ||
            (!btcMode && !hasTokenForChain) ||
            Number.parseFloat(amount) <= 0 ||
            loading ||
            btcLoading ||
            estimating ||
            (btcMode && (!preview || !!estimateError))
          }
          onClick={handleSend}
        >
          <Send className="mr-2 h-5 w-5" />
          {loading || btcLoading
            ? "Sending..."
            : estimating
              ? t("dex.estimateFee", "Estimating fee...")
              : !canTransfer
                ? t("common.noAccount")
                : btcMode
                  ? t("dex.transferBtc", "Send BTC")
                  : `Send ${inputToken.symbol}`}
        </Button>
      </CardContent>
    </Card>
  )
}
