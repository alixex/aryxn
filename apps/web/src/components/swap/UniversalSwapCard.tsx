import { useState, useEffect } from "react"
import {
  ArrowDownUp,
  Settings,
  Clock,
  RotateCw,
  Zap,
  DollarSign,
  TrendingUp,
} from "lucide-react"
import { useAccount } from "wagmi"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import { SwapTokenAmountInput } from "@/components/swap/SwapTokenAmountInput"
import { useExchange } from "@/hooks/use-exchange"
import { useBridge } from "@/hooks/useBridge"
import { useWallet } from "@/hooks/account-hooks"
import { parseUnits } from "viem"

import {
  SUPPORTED_TOKENS,
  getDexTokensByAccountChain,
  getTokenAddressOnChain,
  type TokenInfo,
} from "@/lib/contracts/token-config"
import { Chains } from "@aryxn/chain-constants"
import {
  validateAddress,
  getAddressPlaceholder,
  getChainName,
  isEVMChain,
  type BridgePriority,
  type ChainId,
} from "@aryxn/cross-chain"

type DexSelectableAccount = {
  chain: string
  address: string
  alias?: string
  isExternal: boolean
}

interface UniversalSwapCardProps {
  selectedAccount: DexSelectableAccount | null
  onNavigateToHistory?: () => void
  onClose?: () => void
}

// Supported chains mapping for Bridge
const BRIDGE_CHAINS = [
  { id: 1 as ChainId, name: "Ethereum", icon: "🔷", constant: Chains.ETHEREUM },
  { id: 137 as ChainId, name: "Polygon", icon: "⬣", constant: Chains.POLYGON },
  {
    id: 42161 as ChainId,
    name: "Arbitrum",
    icon: "🔵",
    constant: Chains.ARBITRUM,
  },
  {
    id: 10 as ChainId,
    name: "Optimism",
    icon: "🔴",
    constant: Chains.OPTIMISM,
  },
  { id: 56 as ChainId, name: "BSC", icon: "🟡", constant: "bsc" },
  {
    id: 43114 as ChainId,
    name: "Avalanche",
    icon: "🔺",
    constant: "avalanche",
  },
  { id: 8453 as ChainId, name: "Base", icon: "🔵", constant: Chains.BASE },
]

export function UniversalSwapCard({ selectedAccount }: UniversalSwapCardProps) {
  const { t } = useTranslation()
  const wallet = useWallet()
  const { isConnected } = useAccount()
  const activeEvm = wallet.active.evm

  // Unified State
  const selectedChain = selectedAccount?.chain || Chains.ETHEREUM
  const sourceAddress = selectedAccount?.address || activeEvm?.address || ""
  const isWalletReady = isConnected || !!activeEvm

  const [fromChain, setFromChain] = useState<string>(selectedChain)
  const [toChain, setToChain] = useState<string>(selectedChain)

  const fromChainTokens = getDexTokensByAccountChain(fromChain)
  const toChainTokens = getDexTokensByAccountChain(toChain)

  const [inputToken, setInputToken] = useState<TokenInfo>(
    fromChainTokens[0] || SUPPORTED_TOKENS[0],
  )
  const [outputToken, setOutputToken] = useState<TokenInfo>(
    toChainTokens[1] || toChainTokens[0] || SUPPORTED_TOKENS[1],
  )

  const [inputAmount, setInputAmount] = useState("")

  // Settings State
  const [slippage, setSlippage] = useState(1.0)
  const [priority, setPriority] = useState<BridgePriority>("balanced")
  const [destAddress, setDestAddress] = useState("")
  const [isEditingDestAddress, setIsEditingDestAddress] = useState(false)
  const [addressError, setAddressError] = useState("")
  const [tokenSupportError, setTokenSupportError] = useState("")

  // Hooks
  const exchange = useExchange()
  const bridge = useBridge()

  const isCrossChain = fromChain !== toChain

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

  // Update source chain when account changes
  useEffect(() => {
    if (selectedChain && selectedChain !== fromChain) {
      setFromChain(selectedChain)
      const newTokens = getDexTokensByAccountChain(selectedChain)
      if (newTokens.length > 0) {
        setInputToken(newTokens[0])
      }
    }
  }, [selectedChain])

  // Map to ChainId for Bridge
  const getBridgeChainId = (chainName: string): ChainId | undefined => {
    const chain = BRIDGE_CHAINS.find((c) => c.constant === chainName)
    return chain?.id
  }

  // Handle cross-chain automatic destination address
  useEffect(() => {
    if (!isCrossChain || isEditingDestAddress) return

    if (wallet.internal.activeAddress) {
      const sourceBridgeChain = getBridgeChainId(fromChain)
      const destBridgeChain = getBridgeChainId(toChain)

      if (
        sourceBridgeChain &&
        destBridgeChain &&
        isEVMChain(sourceBridgeChain) &&
        isEVMChain(destBridgeChain)
      ) {
        const evmAddress = wallet.active?.evm?.address
        if (evmAddress) {
          setDestAddress(evmAddress)
        }
      }
    }
  }, [toChain, fromChain, wallet, isCrossChain, isEditingDestAddress])

  // Validate cross-chain address
  useEffect(() => {
    if (!isCrossChain) {
      setAddressError("")
      return
    }

    const destBridgeChain = getBridgeChainId(toChain)
    if (destAddress && destBridgeChain) {
      const isValid = validateAddress(destAddress, destBridgeChain)
      if (!isValid) {
        setAddressError(
          `Invalid ${getChainName(destBridgeChain)} address format`,
        )
      } else {
        setAddressError("")
      }
    } else {
      setAddressError("")
    }
  }, [destAddress, toChain, isCrossChain])

  // Unified Quote Fetching
  useEffect(() => {
    const amountFloat = parseFloat(inputAmount)
    if (!inputAmount || isNaN(amountFloat) || amountFloat === 0) {
      // Clear quotes
      return
    }

    const timer = setTimeout(() => {
      if (!isCrossChain) {
        // Same-chain Swap
        exchange.getQuote({
          fromChain,
          toChain,
          fromToken: inputToken.symbol,
          toToken: outputToken.symbol,
          fromAmount: inputAmount,
          slippage,
        })
      } else {
        // Cross-chain Bridge
        const sourceBridgeChain = getBridgeChainId(fromChain)
        const destBridgeChain = getBridgeChainId(toChain)

        if (!sourceBridgeChain || !destBridgeChain) {
          setTokenSupportError(
            "Bridging between these networks is currently unsupported.",
          )
          bridge.clearQuote()
          return
        }

        if (!destAddress) {
          return // need address for bridge quote
        }

        let amountWei: string
        try {
          amountWei = parseUnits(inputAmount, inputToken.decimals).toString()
        } catch {
          return
        }

        const toTokenAddress = getTokenAddressOnChain(
          outputToken.symbol,
          Number(destBridgeChain),
        )
        if (!toTokenAddress) {
          setTokenSupportError(
            `${outputToken.symbol} is not configured on ${getChainName(destBridgeChain)}`,
          )
          bridge.clearQuote()
          return
        }

        setTokenSupportError("")
        bridge.getQuote({
          fromChain: sourceBridgeChain,
          toChain: destBridgeChain,
          fromToken: inputToken.address,
          toToken: toTokenAddress,
          amount: amountWei,
          fromAddress: sourceAddress,
          toAddress: destAddress,
          priority,
          slippage,
        })
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [
    inputAmount,
    inputToken,
    outputToken,
    fromChain,
    toChain,
    slippage,
    destAddress,
    priority,
    sourceAddress,
    isCrossChain,
  ])

  // Handlers
  const handleSwapTokens = () => {
    const tempChain = fromChain
    const tempToken = inputToken
    setFromChain(toChain)
    setToChain(tempChain)
    setInputToken(outputToken)
    setOutputToken(tempToken)
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

  const handleButtonClick = () => {
    if (!isCrossChain) {
      if (exchange.route) {
        exchange.executeExchange(exchange.route)
      }
    } else {
      bridge.executeBridge(
        inputAmount,
        inputToken.symbol,
        getChainName(getBridgeChainId(fromChain)!),
        getChainName(getBridgeChainId(toChain)!),
      )
    }
  }

  // UI Derived State
  const isLoading = isCrossChain ? bridge.loading : exchange.loading
  const hasError = isCrossChain
    ? !!tokenSupportError || !!addressError
    : !!exchange.error
  const quotedAmount = isCrossChain
    ? bridge.quote
      ? bridge.quote.route.toAmount
      : "0"
    : exchange.route?.toAmount || "0" // Need to correctly format bridge amount

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
    if (isLoading) {
      return {
        text: t("dex.fetchingQuote") + "…",
        disabled: true,
        variant: "default" as const,
      }
    }
    if (hasError) {
      return {
        text: t("dex.swapFailed") || tokenSupportError,
        disabled: true,
        variant: "destructive" as const,
      }
    }
    if (isCrossChain && (!destAddress || addressError)) {
      return {
        text: "Enter valid destination address",
        disabled: true,
        variant: "default" as const,
      }
    }

    const hasRoute = isCrossChain ? !!bridge.quote : !!exchange.route
    return {
      text: isCrossChain
        ? t("dex.reviewBridge", "Review Bridge")
        : t("dex.reviewSwap", "Review Swap"),
      disabled: !hasRoute,
      variant: "default" as const,
    }
  }

  const buttonState = getButtonState()

  // Rendering Input/Output Network Selectors
  const renderNetworkSelector = (
    value: string,
    onChange: (v: string) => void,
    label: string,
  ) => (
    <div className="bg-secondary/30 hover:bg-secondary/50 flex w-fit items-center gap-2 rounded-lg p-1 pr-3 transition-colors">
      <span className="text-muted-foreground pl-2 text-xs font-semibold tracking-wider uppercase">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-7 border-none bg-transparent px-2 font-bold shadow-none focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="glass-strong border-accent/20 max-h-[300px]">
          {getAvailableOutputChains().map((chain) => (
            <SelectItem
              key={chain}
              value={chain}
              className="hover:bg-accent/20 cursor-pointer"
            >
              <span className="capitalize">{chain}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <Card className="glass-premium animate-fade-in-down mx-auto max-w-lg overflow-visible border-none shadow-2xl transition-all duration-500">
      <CardHeader className="glass-strong border-accent/30 bg-card/60 flex flex-row items-center justify-between rounded-t-3xl border-b p-5 px-6 shadow-sm">
        <CardTitle className="text-foreground text-xl font-bold tracking-tight">
          {t("dex.swap", "Swap")}
        </CardTitle>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-accent h-9 w-9 rounded-full transition-colors hover:text-cyan-400"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="glass-strong border-accent/20 w-80 rounded-2xl p-5 shadow-2xl"
            align="end"
          >
            <div className="space-y-4">
              <h4 className="text-sm font-bold">Settings</h4>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs font-semibold uppercase">
                  {t("dex.slippageTolerance", "Slippage Tolerance")}
                </Label>
                <div className="flex gap-2">
                  {[0.5, 1.0, 2.0].map((val) => (
                    <Button
                      key={val}
                      variant={slippage === val ? "default" : "secondary"}
                      size="sm"
                      onClick={() => setSlippage(val)}
                      className="flex-1 rounded-lg"
                    >
                      {val}%
                    </Button>
                  ))}
                  <Input
                    type="number"
                    value={slippage}
                    onChange={(e) =>
                      setSlippage(parseFloat(e.target.value) || 1.0)
                    }
                    className="w-16 rounded-lg text-center"
                  />
                </div>
              </div>
              {isCrossChain && (
                <div className="border-border space-y-2 border-t pt-2">
                  <Label className="text-muted-foreground text-xs font-semibold uppercase">
                    Bridge Route Priority
                  </Label>
                  <Tabs
                    value={priority}
                    onValueChange={(v) => setPriority(v as BridgePriority)}
                  >
                    <TabsList className="bg-secondary/50 grid h-9 w-full grid-cols-3">
                      <TabsTrigger value="fastest" className="text-xs">
                        <Zap className="mr-1 h-3 w-3" />
                        Fast
                      </TabsTrigger>
                      <TabsTrigger value="balanced" className="text-xs">
                        <TrendingUp className="mr-1 h-3 w-3" />
                        Bal
                      </TabsTrigger>
                      <TabsTrigger value="cheapest" className="text-xs">
                        <DollarSign className="mr-1 h-3 w-3" />
                        Cheap
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </CardHeader>

      <CardContent className="relative space-y-1 p-2 sm:p-4">
        {/* FROM BLOCK */}
        <div className="bg-card/40 focus-within:border-ring/30 focus-within:bg-card/60 group rounded-3xl border border-transparent p-4 transition-all">
          <div className="mb-3 flex items-center justify-between">
            {renderNetworkSelector(
              fromChain,
              setFromChain,
              t("dex.from", "From"),
            )}
          </div>
          <SwapTokenAmountInput
            tokenValue={inputToken.symbol}
            onTokenChange={(symbol) => {
              const token = fromChainTokens.find(
                (item) => item.symbol === symbol,
              )
              if (token) setInputToken(token)
            }}
            tokenOptions={fromChainTokens.map((t) => ({
              value: t.symbol,
              label: t.symbol,
            }))}
            amountValue={inputAmount}
            onAmountChange={handleInputChange}
            amountPlaceholder="0"
            className="border-none bg-transparent p-0 shadow-none focus-within:ring-0"
            amountClassName="text-4xl text-foreground placeholder:text-muted-foreground/30 px-0 h-14"
            tokenTriggerClassName="h-10 rounded-xl bg-background border border-border/50 shadow-sm w-fit min-w-[100px] hover:bg-accent"
          />
        </div>

        {/* SWAP FLIP BUTTON */}
        <div className="absolute top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSwapTokens}
            className="glass-strong border-background bg-card hover:bg-accent h-11 w-11 rounded-xl border-2 p-0 shadow-md transition-all duration-300 hover:scale-110 hover:border-cyan-400/50 hover:text-cyan-400"
          >
            <ArrowDownUp className="h-5 w-5" />
          </Button>
        </div>

        {/* TO BLOCK */}
        <div className="bg-card/40 focus-within:border-ring/30 focus-within:bg-card/60 group rounded-3xl border border-transparent p-4 transition-all">
          <div className="mb-3 flex items-center justify-between">
            {renderNetworkSelector(toChain, setToChain, t("dex.to", "To"))}
            {isCrossChain && (
              <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-cyan-500">
                BRIDGE
              </span>
            )}
          </div>
          <SwapTokenAmountInput
            tokenValue={outputToken.symbol}
            onTokenChange={(symbol) => {
              const token = toChainTokens.find((item) => item.symbol === symbol)
              if (token) setOutputToken(token)
            }}
            tokenOptions={toChainTokens.map((t) => ({
              value: t.symbol,
              label: t.symbol,
            }))}
            amountValue={quotedAmount}
            amountReadOnly
            amountPlaceholder="-"
            className="border-none bg-transparent p-0 shadow-none focus-within:ring-0"
            amountClassName="text-4xl text-foreground placeholder:text-muted-foreground/30 px-0 h-14"
            tokenTriggerClassName="h-10 rounded-xl bg-background border border-border/50 shadow-sm w-fit min-w-[100px] hover:bg-accent"
          />
        </div>

        {/* CROSS-CHAIN ADDRESS INPUT (Conditional) */}
        {isCrossChain && (
          <div className="px-2 pt-3">
            {!isEditingDestAddress && destAddress === sourceAddress ? (
              <div className="bg-card/50 border-border/50 flex items-center justify-between rounded-xl border p-3">
                <span className="text-muted-foreground text-sm font-medium">
                  To your address
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary h-6 px-2 text-xs"
                  onClick={() => setIsEditingDestAddress(true)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="animate-fade-in-down space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground pl-1 text-xs font-semibold">
                    Destination Address
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-6 px-2 text-xs"
                    onClick={() => {
                      setIsEditingDestAddress(false)
                      setDestAddress(sourceAddress)
                    }}
                  >
                    Use my address
                  </Button>
                </div>
                <Input
                  value={destAddress}
                  onChange={(e) => setDestAddress(e.target.value)}
                  placeholder={getAddressPlaceholder(
                    getBridgeChainId(toChain) || 1,
                  )}
                  className="bg-background h-11 rounded-xl"
                />
              </div>
            )}
          </div>
        )}

        {/* QUOTE DETAILS DISPLAY */}
        {(exchange.route || bridge.quote) && !isLoading && (
          <div className="animate-fade-in space-y-2.5 px-2 pt-4 text-sm">
            {!isCrossChain && exchange.route ? (
              <>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="text-foreground">
                    {exchange.route.provider}
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="text-foreground">
                    {exchange.route.feePercent !== undefined &&
                    exchange.route.feePercent > 0
                      ? `${exchange.route.feePercent.toFixed(2)}%`
                      : "Free"}
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Time</span>
                  <span className="text-foreground flex items-center gap-1 text-emerald-500">
                    <Clock className="h-3.5 w-3.5" /> {"< 1 min"}
                  </span>
                </div>
              </>
            ) : bridge.quote ? (
              <>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Est. Time</span>
                  <span className="text-foreground flex items-center gap-1">
                    {Math.ceil(bridge.quote.cost.estimatedTime / 60)} mins
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Network Fee</span>
                  <span className="text-foreground">
                    ${bridge.quote.cost.gasCost.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Bridge Fee</span>
                  <span className="text-foreground">
                    ${bridge.quote.cost.protocolFees.toFixed(2)}
                  </span>
                </div>
                <div className="border-border flex justify-between border-t pt-2 font-bold">
                  <span className="text-muted-foreground">Total Cost</span>
                  <span className="text-orange-500">
                    ${bridge.quote.cost.total.toFixed(2)}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ACTION BUTTON */}
        <div className="pt-4">
          <Button
            onClick={handleButtonClick}
            disabled={buttonState.disabled}
            className={`h-14 w-full rounded-2xl text-lg font-bold shadow-lg transition-all ${buttonState.disabled ? "opacity-50" : "hover:scale-[1.02] hover:shadow-cyan-500/20 active:scale-95"}`}
            variant={buttonState.variant}
          >
            {isLoading && <RotateCw className="mr-2 h-5 w-5 animate-spin" />}
            {buttonState.text}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
