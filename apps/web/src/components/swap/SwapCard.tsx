import { useEffect, useState } from "react"
import { ArrowDownUp, Settings, Info } from "lucide-react"
import { useConnection } from "wagmi"
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
import { SwapTokenAmountInput } from "@/components/swap/SwapTokenAmountInput"
import { useExchange } from "@/hooks/use-exchange"
import {
  SUPPORTED_TOKENS,
  getDexTokensByAccountChain,
  type TokenInfo,
} from "@/lib/contracts/token-config"
import { useWallet } from "@/hooks/account-hooks"
import { Chains } from "@aryxn/chain-constants"

type DexSelectableAccount = {
  chain: string
  address: string
  alias?: string
  isExternal: boolean
}

interface SwapCardProps {
  selectedAccount: DexSelectableAccount
  onNavigateToHistory?: () => void
  onClose?: () => void
}

export function SwapCard({ selectedAccount }: SwapCardProps) {
  const { t } = useTranslation()
  const wallet = useWallet()
  const { isConnected } = useConnection()
  const activeEvm = wallet.active.evm

  const exchange = useExchange()
  const selectedChain = selectedAccount?.chain || Chains.ETHEREUM
  const chainTokens = getDexTokensByAccountChain(selectedChain)

  // Input/Output token selection
  const [inputToken, setInputToken] = useState<TokenInfo>(
    chainTokens[0] || SUPPORTED_TOKENS[0],
  )
  const [outputToken, setOutputToken] = useState<TokenInfo>(
    chainTokens[1] || chainTokens[0] || SUPPORTED_TOKENS[1],
  )
  const [inputAmount, setInputAmount] = useState("")
  const [slippage, setSlippage] = useState(1.0)
  const [showSettings, setShowSettings] = useState(false)
  const [outputChain, setOutputChain] = useState<string>(selectedChain)

  const isWalletReady = isConnected || !!activeEvm

  // Update quote when inputs change
  useEffect(() => {
    if (!inputAmount || parseFloat(inputAmount) === 0) return

    const timer = setTimeout(() => {
      exchange.getQuote({
        fromChain: selectedChain,
        toChain: outputChain,
        fromToken: inputToken.symbol,
        toToken: outputToken.symbol,
        fromAmount: inputAmount,
        slippage,
      })
    }, 500)

    return () => clearTimeout(timer)
  }, [
    inputAmount,
    inputToken.symbol,
    outputToken.symbol,
    selectedChain,
    outputChain,
    slippage,
    exchange.getQuote,
  ])

  // Sync output chain with selected chain if not explicitly bridging
  useEffect(() => {
    if (selectedChain !== Chains.BITCOIN && selectedChain !== Chains.ARWEAVE) {
      if (outputChain === selectedChain) return
      setOutputChain(selectedChain)
    }
  }, [selectedChain])

  // Swap tokens (flip input/output)
  const handleSwapTokens = () => {
    setInputToken(outputToken)
    setOutputToken(inputToken)
  }

  const handleInputChange = (value: string) => {
    if (value === "") {
      setInputAmount("")
      return
    }
    const regex = /^\d*\.?\d*$/
    if (!regex.test(value)) return
    if ((value.match(/\./g) || []).length > 1) return
    setInputAmount(value)
  }

  const isBridgeFlow =
    outputChain !== selectedChain ||
    selectedChain === Chains.BITCOIN ||
    selectedChain === Chains.ARWEAVE

  // Available output chains
  const getAvailableOutputChains = (): string[] => {
    return [
      Chains.ETHEREUM,
      Chains.SOLANA,
      Chains.ARBITRUM,
      Chains.BASE,
      Chains.OPTIMISM,
      Chains.POLYGON,
    ]
  }

  const handleButtonClick = () => {
    if (exchange.route) {
      exchange.executeExchange(exchange.route)
    }
  }

  const getButtonState = () => {
    if (!isWalletReady) {
      return {
        text: t("dex.pleaseConnectWallet"),
        disabled: true,
        variant: "default" as const,
      }
    }
    if (!inputAmount || parseFloat(inputAmount) === 0) {
      return {
        text: t("dex.enterAmount"),
        disabled: true,
        variant: "default" as const,
      }
    }
    if (exchange.loading) {
      return {
        text: t("dex.fetchingQuote") + "…",
        disabled: true,
        variant: "default" as const,
      }
    }
    if (exchange.error) {
      return {
        text: t("dex.swapFailed"),
        disabled: false,
        variant: "destructive" as const,
      }
    }

    return {
      text: isBridgeFlow
        ? t("bridge.executeSwap", "Execute Exchange")
        : t("dex.swap"),
      disabled: !exchange.route,
      variant: "default" as const,
    }
  }

  const buttonState = getButtonState()
  const tokenOptions = chainTokens.map((token) => ({
    value: token.symbol,
    label: token.symbol,
    subtitle: token.name,
  }))

  return (
    <Card className="glass-premium animate-fade-in-down border-none shadow-2xl transition-all duration-500">
      <CardHeader className="glass-strong animate-fade-in-down border-accent/30 bg-card/60 rounded-t-2xl border-b-2 p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground text-lg font-bold">
            {t("dex.swap")}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="h-8 w-8 rounded-full p-0 hover:text-cyan-400"
            aria-label={t("dex.settingsButton", "Toggle settings")}
            aria-expanded={showSettings}
          >
            <Settings
              className={`h-4 w-4 transition-transform ${showSettings ? "rotate-90" : ""}`}
            />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-6">
        {/* Settings Panel */}
        {showSettings && (
          <div className="animate-fade-in border-border bg-card rounded-xl border p-4">
            <Label
              htmlFor="slippage"
              className="text-foreground text-sm font-semibold"
            >
              {t("dex.slippageTolerance")} (%)
            </Label>
            <div className="mt-2 flex gap-2">
              {[0.5, 1.0, 2.0].map((val) => (
                <Button
                  key={val}
                  variant={slippage === val ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setSlippage(val)}
                  className="flex-1"
                >
                  {val}%
                </Button>
              ))}
              <Input
                id="slippage"
                type="number"
                min="0.1"
                max="50"
                step="0.1"
                value={slippage}
                onChange={(e) => setSlippage(parseFloat(e.target.value) || 1.0)}
                autoComplete="off"
                className="w-20"
              />
            </div>
          </div>
        )}

        {/* Input Token */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-foreground text-sm font-semibold">
              {t("dex.from")}
            </Label>
          </div>
          <SwapTokenAmountInput
            tokenValue={inputToken.symbol}
            onTokenChange={(symbol: string) => {
              const token = chainTokens.find(
                (item: any) => item.symbol === symbol,
              )
              if (token) setInputToken(token)
            }}
            tokenOptions={tokenOptions}
            amountValue={inputAmount}
            onAmountChange={handleInputChange}
            amountPlaceholder="0.0"
            amountType="text"
            amountInputMode="decimal"
          />
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSwapTokens}
            className="border-border bg-background hover:bg-accent h-10 w-10 rounded-full border-2 shadow-md transition-all hover:scale-110 hover:border-cyan-400/50"
          >
            <ArrowDownUp className="text-foreground h-5 w-5" />
          </Button>
        </div>

        {/* Output Token */}
        <div className="space-y-3">
          <Label className="text-foreground text-sm font-semibold">
            {t("dex.to")}
          </Label>
          <SwapTokenAmountInput
            tokenValue={outputToken.symbol}
            onTokenChange={(symbol: string) => {
              const token = chainTokens.find(
                (item: any) => item.symbol === symbol,
              )
              if (token) setOutputToken(token)
            }}
            tokenOptions={tokenOptions}
            amountValue={exchange.route?.toAmount || "0"}
            amountReadOnly
            amountPlaceholder="0.0"
          />
        </div>

        {/* Destination Chain Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-foreground text-sm font-semibold">
              {t("swap.destinationChain")}
            </Label>
            {isBridgeFlow && (
              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-500">
                BRIDGE
              </span>
            )}
          </div>
          <Select value={outputChain} onValueChange={setOutputChain}>
            <SelectTrigger className="bg-background/50 w-full">
              <SelectValue placeholder={t("swap.selectChain")} />
            </SelectTrigger>
            <SelectContent className="glass-strong border-accent/20">
              {getAvailableOutputChains().map((chain) => (
                <SelectItem
                  key={chain}
                  value={chain}
                  className="hover:bg-accent/20"
                >
                  <span className="capitalize">{chain}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Details Display */}
        {exchange.route && (
          <div className="border-border bg-card space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {isBridgeFlow
                  ? t("bridge.estimatedTime")
                  : t("dex.estimatedTime", "Estimated Time")}
              </span>
              <span className="text-foreground font-semibold">
                {Math.ceil(exchange.route.estimatedTime / 60)} mins
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("dex.provider")}</span>
              <span className="text-foreground font-semibold">
                {exchange.route.provider}
              </span>
            </div>
            {exchange.route.feePercent > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("dex.fee")}</span>
                <span className="text-foreground font-semibold">
                  {exchange.route.feePercent.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {exchange.error && (
          <div className="animate-shake border-destructive/30 bg-destructive/10 rounded-xl border p-4">
            <div className="text-destructive flex gap-3">
              <Info className="h-5 w-5 shrink-0" />
              <p className="text-sm">{exchange.error}</p>
            </div>
          </div>
        )}

        {/* Execute Button */}
        <Button
          onClick={handleButtonClick}
          disabled={buttonState.disabled}
          className="h-14 w-full rounded-xl text-lg font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95"
          variant={buttonState.variant}
        >
          {buttonState.text}
        </Button>
      </CardContent>
    </Card>
  )
}
