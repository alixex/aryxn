import { useState } from "react"
import { ArrowDownUp, Settings, Info, Zap } from "lucide-react"
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
import {
  useMultiHopSwap,
  SwapState,
  useInternalDexSwap,
} from "@/hooks/dex-hooks"
import { SUPPORTED_TOKENS, type TokenInfo } from "@/lib/contracts/token-config"
import { useInternal, formatTimestamp } from "@/hooks/account-hooks"
import type { WalletRecord } from "@/lib/utils"

export function SwapCard() {
  const { t } = useTranslation()
  const { isConnected } = useConnection()
  const walletManager = useInternal()

  // Check if internal wallet is available for Ethereum
  const hasInternalEthAccount =
    walletManager.isUnlocked &&
    !!walletManager.activeAddress &&
    walletManager.wallets.find(
      (w: WalletRecord) => w.address === walletManager.activeAddress,
    )?.chain === "ethereum"

  // Determine which wallet type to use
  const useInternalWallet = hasInternalEthAccount && !isConnected
  const isWalletReady = isConnected || hasInternalEthAccount

  // Input/Output token selection
  const [inputToken, setInputToken] = useState<TokenInfo>(SUPPORTED_TOKENS[0])
  const [outputToken, setOutputToken] = useState<TokenInfo>(SUPPORTED_TOKENS[1]) // Changed default to USDC (index 1 usually)
  const [inputAmount, setInputAmount] = useState("")
  const [slippage, setSlippage] = useState(1.0) // 1% default slippage
  const [showSettings, setShowSettings] = useState(false)

  // External wallet swap hook (wagmi)
  const externalSwap = useMultiHopSwap({
    inputToken: inputToken.address,
    outputToken: outputToken.address,
    inputAmount,
    decimalsIn: inputToken.decimals,
    decimalsOut: outputToken.decimals,
    slippage,
  })

  // Internal wallet swap hook (ethers)
  const internalSwap = useInternalDexSwap({
    inputToken: inputToken.address,
    outputToken: outputToken.address,
    inputAmount,
    decimalsIn: inputToken.decimals,
    decimalsOut: outputToken.decimals,
    slippage,
  })

  // Use the appropriate swap hook based on wallet type
  const {
    swapState,
    outputAmount,
    quote,
    formattedBalance,
    hasInsufficientBalance,
    approve,
    gasEstimate,
    gasPrice,
    error,
    executeSwap,
    swapHash,
    swapSuccess,
    lastUpdated,
  } = useInternalWallet ? internalSwap : externalSwap

  // Swap tokens (flip input/output)
  const handleSwapTokens = () => {
    setInputToken(outputToken)
    setOutputToken(inputToken)
  }

  // Set max amount
  const handleMaxClick = () => {
    setInputAmount(formattedBalance)
  }

  // Validate and format input
  const handleInputChange = (value: string) => {
    if (value === "") {
      setInputAmount("")
      return
    }
    const regex = /^\d*\.?\d*$/
    if (!regex.test(value)) return
    if ((value.match(/\./g) || []).length > 1) return
    const numValue = parseFloat(value)
    if (numValue < 0) return
    setInputAmount(value)
  }

  // Get button state and text
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

    if (hasInsufficientBalance) {
      return {
        text: t("dex.insufficientBalance"),
        disabled: true,
        variant: "destructive" as const,
      }
    }

    if (inputToken.address === outputToken.address) {
      return {
        text: t("dex.selectToken"),
        disabled: true,
        variant: "default" as const,
      }
    }

    switch (swapState) {
      case SwapState.FETCHING_QUOTE:
        return {
          text: t("dex.fetchingQuote") + "…",
          disabled: true,
          variant: "default" as const,
        }
      case SwapState.NEEDS_APPROVAL:
        return {
          text: t("dex.approve", { token: inputToken.symbol }),
          disabled: false,
          variant: "default" as const,
        }
      case SwapState.APPROVING:
        return {
          text: t("dex.approving") + "…",
          disabled: true,
          variant: "default" as const,
        }
      case SwapState.READY:
        return {
          text: t("dex.swap"),
          disabled: false,
          variant: "default" as const,
        }
      case SwapState.SWAPPING:
        return {
          text: t("dex.swapping") + "…",
          disabled: true,
          variant: "default" as const,
        }
      case SwapState.CONFIRMING:
        return {
          text: t("dex.confirming") + "…",
          disabled: true,
          variant: "default" as const,
        }
      case SwapState.SUCCESS:
        return {
          text: t("dex.swapSuccess"),
          disabled: false,
          variant: "default" as const,
        }
      case SwapState.ERROR:
        return {
          text: t("dex.swapFailed"),
          disabled: false,
          variant: "destructive" as const,
        }
      default:
        return {
          text: t("dex.swap"),
          disabled: true,
          variant: "default" as const,
        }
    }
  }

  const handleButtonClick = () => {
    if (swapState === SwapState.NEEDS_APPROVAL) {
      approve()
    } else if (swapState === SwapState.READY) {
      executeSwap()
    } else if (swapState === SwapState.SUCCESS) {
      setInputAmount("")
    }
  }

  const buttonState = getButtonState()

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
            <p className="text-muted-foreground mt-2 text-xs">
              {t("dex.slippageTooltip")}
            </p>
          </div>
        )}

        {/* Input Token */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-foreground text-sm font-semibold">
              {t("dex.from")}
            </Label>
            {isWalletReady && (
              <div className="text-muted-foreground text-xs">
                {t("dex.balance")}:{" "}
                <span className="text-foreground font-semibold">
                  {formattedBalance}
                </span>{" "}
                <button
                  onClick={handleMaxClick}
                  className="bg-secondary text-foreground ml-2 rounded px-2 py-1 text-[10px] font-bold transition-colors hover:text-cyan-400"
                  aria-label={t("dex.setMaxAmount", "Set maximum amount")}
                >
                  MAX
                </button>
                {lastUpdated && (
                  <div className="text-muted-foreground/50 mt-1 text-[10px]">
                    {formatTimestamp(lastUpdated)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="border-border bg-background focus-within:border-ring focus-within:ring-ring/10 flex items-center gap-3 rounded-xl border-2 p-4 shadow-sm transition-all focus-within:ring-2">
            <Select
              value={inputToken.symbol}
              onValueChange={(symbol) => {
                const token = SUPPORTED_TOKENS.find((t) => t.symbol === symbol)
                if (token) setInputToken(token)
              }}
            >
              <SelectTrigger className="bg-secondary hover:bg-accent w-28 shrink-0 justify-center border-none px-3 py-2.5 font-bold shadow-none transition-colors">
                <SelectValue>
                  <span className="text-base">{inputToken.symbol}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_TOKENS.map((token) => (
                  <SelectItem key={token.address} value={token.symbol}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground font-bold">
                        {token.symbol}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {token.name}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="bg-border h-10 w-px"></div>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={inputAmount}
              onChange={(e) => handleInputChange(e.target.value)}
              autoComplete="off"
              className="min-w-0 flex-1 [appearance:textfield] border-none bg-transparent px-2 text-right text-xl font-bold shadow-none focus-visible:ring-0 sm:text-2xl lg:text-3xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label={t("dex.inputAmount", "Input amount")}
            />
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSwapTokens}
            className="border-border bg-background hover:bg-accent h-10 w-10 rounded-full border-2 shadow-md transition-all hover:scale-110 hover:border-cyan-400/50"
            aria-label={t("dex.swapTokens", "Swap token positions")}
          >
            <ArrowDownUp className="text-foreground h-5 w-5" />
          </Button>
        </div>

        {/* Output Token */}
        <div className="space-y-3">
          <Label className="text-foreground text-sm font-semibold">
            {t("dex.to")} ({t("dex.expectedOutput")})
          </Label>
          <div className="border-border bg-card flex items-center gap-3 rounded-xl border-2 p-4">
            <Select
              value={outputToken.symbol}
              onValueChange={(symbol) => {
                const token = SUPPORTED_TOKENS.find((t) => t.symbol === symbol)
                if (token) setOutputToken(token)
              }}
            >
              <SelectTrigger className="bg-background hover:bg-secondary w-28 shrink-0 justify-center border-none px-3 py-2.5 font-bold shadow-none transition-colors">
                <SelectValue>
                  <span className="text-base">{outputToken.symbol}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_TOKENS.map((token) => (
                  <SelectItem key={token.address} value={token.symbol}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground font-bold">
                        {token.symbol}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {token.name}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="bg-border h-10 w-px"></div>
            <Input
              type="text"
              placeholder="0.0"
              value={outputAmount}
              readOnly
              autoComplete="off"
              className="min-w-0 flex-1 cursor-default border-none bg-transparent px-2 text-right text-3xl font-bold shadow-none"
            />
          </div>
        </div>

        {/* Route and Details */}
        {quote && (
          <div className="border-border bg-card space-y-3 rounded-xl border p-4">
            <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4" aria-hidden="true" />
              {t("dex.swapDetails")}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("dex.route")}</span>
                <span className="text-foreground font-semibold">
                  {quote.route.length === 2 ? (
                    <span className="bg-secondary text-foreground rounded-full px-2 py-0.5 text-xs">
                      {t("dex.directSwap")}
                    </span>
                  ) : (
                    <span className="bg-secondary text-foreground rounded-full px-2 py-0.5 text-xs">
                      {quote.route.length - 1}{" "}
                      {t(quote.route.length > 2 ? "dex.hops" : "dex.hop")}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("dex.protocolFee")}
                </span>
                <span className="text-foreground font-semibold">0.04%</span>
              </div>
              {gasPrice && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("dex.gasPrice")}
                  </span>
                  <span className="text-foreground font-semibold">
                    {gasPrice} Gwei
                  </span>
                </div>
              )}
              {gasEstimate !== "0" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("dex.estimatedGas")}
                  </span>
                  <span className="text-foreground font-semibold">
                    {(Number(gasEstimate) / 1000).toFixed(0)}k units
                  </span>
                </div>
              )}
              <div className="border-border border-t pt-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("dex.minimumReceived")}
                  </span>
                  <span className="text-foreground font-bold">
                    {quote.formattedMinimumOutput} {outputToken.symbol}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="animate-shake border-destructive bg-destructive/10 rounded-xl border p-4">
            <div className="flex gap-3">
              <Info
                className="text-destructive h-5 w-5 shrink-0"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-destructive font-semibold">
                  {t("dex.error")}
                </p>
                <p className="text-destructive/80 mt-1 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success Display */}
        {swapSuccess && swapHash && (
          <div className="animate-fade-in border-border bg-card rounded-xl border p-4">
            <div className="flex gap-3">
              <div className="bg-secondary flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                <Info className="text-foreground h-4 w-4" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <p className="text-foreground font-semibold">
                  {t("dex.swapSuccess")}
                </p>
                <a
                  href={`https://etherscan.io/tx/${swapHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground mt-1 inline-block text-sm underline hover:text-cyan-400"
                >
                  {t("dex.viewOnEtherscan")}
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Swap Button */}
        <Button
          onClick={handleButtonClick}
          disabled={buttonState.disabled}
          className="h-14 w-full rounded-xl text-lg font-bold shadow-lg transition-all hover:scale-[1.02] disabled:scale-100"
          variant={buttonState.variant}
        >
          {buttonState.text}
        </Button>
      </CardContent>
    </Card>
  )
}
