import { useState, useEffect, useRef } from "react"
import {
  Settings,
  Clock,
  RotateCw,
  AlertTriangle,
  Zap,
  DollarSign,
  TrendingUp,
} from "lucide-react"
import { useTranslation } from "@/i18n/config"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SwapTokenAmountInput } from "@/components/swap/SwapTokenAmountInput"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SUPPORTED_TOKENS, type TokenInfo } from "@/lib/contracts/token-config"
import { useBridge } from "@/hooks/useBridge"
import {
  liFiBridgeService,
  validateAddress,
  getAddressPlaceholder,
  getChainName,
  isEVMChain,
  type BridgePriority,
  type ChainId,
} from "@aryxn/cross-chain"
import { useWallet } from "@/providers/wallet-provider"
import { useSearchParams } from "react-router-dom"

// Supported chains with Li.Fi ChainIds
const CHAINS = [
  { id: 1 as ChainId, name: "Ethereum", icon: "🔷" },
  { id: 137 as ChainId, name: "Polygon", icon: "⬣" },
  { id: 42161 as ChainId, name: "Arbitrum", icon: "🔵" },
  { id: 10 as ChainId, name: "Optimism", icon: "🔴" },
  { id: 56 as ChainId, name: "BSC", icon: "🟡" },
  { id: 43114 as ChainId, name: "Avalanche", icon: "🔺" },
]

export function BridgeCard() {
  const { t } = useTranslation()
  const wallet = useWallet()
  const [searchParams] = useSearchParams()
  const prefillApplied = useRef(false)

  const [chainTypes, setChainTypes] = useState<Record<number, string>>({})

  const [sourceChain, setSourceChain] = useState<ChainId>(1) // Ethereum
  const [destChain, setDestChain] = useState<ChainId>(137) // Polygon
  const [priority, setPriority] = useState<BridgePriority>("balanced")

  const [inputToken, setInputToken] = useState<TokenInfo>(SUPPORTED_TOKENS[0])
  const [inputAmount, setInputAmount] = useState("")

  // Destination address
  const [destAddress, setDestAddress] = useState("")
  const [addressError, setAddressError] = useState("")

  const { loading, quote, getQuote, executeBridge } = useBridge()
  const tokenOptions = SUPPORTED_TOKENS.map((token) => ({
    value: token.symbol,
    label: token.symbol,
  }))

  useEffect(() => {
    if (prefillApplied.current) return

    const source = searchParams.get("source")
    if (source !== "upload") return

    const tokenParam = (searchParams.get("token") || "").toUpperCase()
    const chainParam = (searchParams.get("chain") || "").toLowerCase()

    if (tokenParam) {
      const matchedToken = SUPPORTED_TOKENS.find(
        (token) => token.symbol.toUpperCase() === tokenParam,
      )
      if (matchedToken) {
        setInputToken(matchedToken)
      }
    }

    const chainIdByKey: Record<string, ChainId> = {
      ethereum: 1,
      evm: 1,
      polygon: 137,
      arbitrum: 42161,
      optimism: 10,
      bsc: 56,
      avalanche: 43114,
    }
    const mappedChain = chainIdByKey[chainParam]
    if (mappedChain) {
      setSourceChain(mappedChain)
    }

    prefillApplied.current = true
  }, [searchParams])

  useEffect(() => {
    let isMounted = true

    const fetchChains = async () => {
      try {
        const chains = await liFiBridgeService.getSupportedChains()
        if (!isMounted) return
        const map: Record<number, string> = {}
        chains.forEach((chain) => {
          map[chain.id] = chain.chainType
        })
        setChainTypes(map)
      } catch (error) {
        console.warn("Failed to load chain types", error)
      }
    }

    fetchChains()
    return () => {
      isMounted = false
    }
  }, [])

  const isSimulationUnsupported = (chainId: ChainId) => {
    const chainType = chainTypes[Number(chainId)]
    return chainType === "UTXO" || chainType === "TVM"
  }

  // Auto-fill destination address if user has account on destination chain
  useEffect(() => {
    if (!destAddress && wallet.internal.activeAddress) {
      // For EVM chains, use the same address
      if (isEVMChain(sourceChain) && isEVMChain(destChain)) {
        const evmAddress = wallet.active?.evm?.address
        if (evmAddress) {
          setDestAddress(evmAddress)
        }
      }
    }
  }, [destChain, wallet, destAddress, sourceChain])

  // Validate address when it changes
  useEffect(() => {
    if (destAddress) {
      const isValid = validateAddress(destAddress, destChain)
      if (!isValid) {
        setAddressError(`Invalid ${getChainName(destChain)} address format`)
      } else {
        setAddressError("")
      }
    } else {
      setAddressError("")
    }
  }, [destAddress, destChain])

  // Debounced quote fetching
  useEffect(() => {
    if (
      parseFloat(inputAmount) > 0 &&
      destAddress &&
      !addressError &&
      wallet.active?.evm?.address
    ) {
      const timer = setTimeout(() => {
        // Convert amount to wei (assuming 18 decimals for now)
        const amountWei = (
          parseFloat(inputAmount) * Math.pow(10, inputToken.decimals)
        ).toString()

        getQuote({
          fromChain: sourceChain,
          toChain: destChain,
          fromToken: inputToken.address,
          toToken: inputToken.address, // Same token for now
          amount: amountWei,
          fromAddress: wallet.active.evm!.address,
          toAddress: destAddress,
          priority,
          slippage: 0.5,
        })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [
    inputAmount,
    inputToken,
    sourceChain,
    destChain,
    destAddress,
    addressError,
    priority,
    wallet,
    getQuote,
  ])

  return (
    <Card className="glass-premium animate-fade-in-down border-none shadow-2xl transition-all duration-500">
      <CardHeader className="glass-strong animate-fade-in-down border-accent/30 bg-card/60 rounded-t-2xl border-b-2 p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground text-lg font-bold">
            {t("dex.bridge", "Cross-Chain Bridge")}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-full p-0"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        {/* Priority Selector */}
        <Tabs
          value={priority}
          onValueChange={(v) => setPriority(v as BridgePriority)}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fastest" className="text-xs sm:text-sm">
              <Zap className="mr-1 h-3 w-3" />
              Fastest
            </TabsTrigger>
            <TabsTrigger value="balanced" className="text-xs sm:text-sm">
              <TrendingUp className="mr-1 h-3 w-3" />
              Balanced
            </TabsTrigger>
            <TabsTrigger value="cheapest" className="text-xs sm:text-sm">
              <DollarSign className="mr-1 h-3 w-3" />
              Cheapest
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Source & Destination Chain Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              From Network
            </Label>
            <Select
              value={sourceChain.toString()}
              onValueChange={(v) => setSourceChain(Number(v) as ChainId)}
            >
              <SelectTrigger className="bg-secondary/50 border-input/50 h-12 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAINS.map((chain) => (
                  <SelectItem key={chain.id} value={chain.id.toString()}>
                    <span className="mr-2">{chain.icon}</span> {chain.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              To Network
            </Label>
            <Select
              value={destChain.toString()}
              onValueChange={(v) => setDestChain(Number(v) as ChainId)}
            >
              <SelectTrigger className="bg-secondary/50 border-input/50 h-12 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAINS.map((chain) => (
                  <SelectItem key={chain.id} value={chain.id.toString()}>
                    <span className="mr-2">{chain.icon}</span> {chain.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(isSimulationUnsupported(sourceChain) ||
          isSimulationUnsupported(destChain)) && (
          <Alert className="border-orange-500/50 bg-orange-500/10">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <AlertTitle className="text-orange-700 dark:text-orange-400">
              Simulation Not Available
            </AlertTitle>
            <AlertDescription className="text-sm text-orange-600 dark:text-orange-300">
              This chain does not support simulation. You can still bridge, but
              the transaction may fail and waste gas.
            </AlertDescription>
          </Alert>
        )}

        {/* Asset Input */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label className="text-foreground text-sm font-semibold">
              Asset to Bridge
            </Label>
            <span className="text-muted-foreground text-xs">Balance: 0.00</span>
          </div>

          <SwapTokenAmountInput
            tokenValue={inputToken.symbol}
            onTokenChange={(symbol) => {
              const token = SUPPORTED_TOKENS.find((item) => item.symbol === symbol)
              if (token) setInputToken(token)
            }}
            tokenOptions={tokenOptions}
            amountValue={inputAmount}
            onAmountChange={setInputAmount}
            amountType="number"
            amountInputMode="decimal"
            amountPlaceholder="0.0"
          />
        </div>

        {/* Destination Address Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-foreground text-sm font-semibold">
              Destination Address
            </Label>
            {wallet.active?.evm?.address &&
              isEVMChain(destChain) &&
              destAddress !== wallet.active.evm!.address && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDestAddress(wallet.active!.evm!.address)}
                  className="text-primary h-auto p-0 text-xs font-semibold hover:underline"
                >
                  Use My Address
                </Button>
              )}
          </div>
          <Input
            value={destAddress}
            onChange={(e) => setDestAddress(e.target.value)}
            placeholder={getAddressPlaceholder(destChain)}
            className={`border-border bg-background focus-within:border-ring h-12 rounded-xl font-mono text-sm ${
              addressError ? "border-destructive" : ""
            }`}
          />
          {addressError && (
            <p className="text-destructive text-xs">{addressError}</p>
          )}
        </div>

        {/* Risk Warning */}
        {quote?.risk.level === "MEDIUM" && (
          <Alert
            variant="default"
            className="border-yellow-500/50 bg-yellow-500/10"
          >
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertTitle className="text-yellow-700 dark:text-yellow-400">
              Medium Amount
            </AlertTitle>
            <AlertDescription className="text-sm text-yellow-600 dark:text-yellow-300">
              {quote.risk.warning}
            </AlertDescription>
          </Alert>
        )}

        {quote?.risk.level === "HIGH" && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Large Amount Detected</AlertTitle>
            <AlertDescription className="text-sm">
              {quote.risk.warning}
            </AlertDescription>
          </Alert>
        )}

        {/* Quote Display */}
        {loading ? (
          <div className="text-muted-foreground flex animate-pulse items-center justify-center gap-2 py-4">
            <RotateCw className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Fetching best route...</span>
          </div>
        ) : (
          quote && (
            <div className="border-border bg-card/50 space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Est. Time
                </span>
                <span className="text-foreground font-bold">
                  ~{Math.ceil(quote.cost.estimatedTime / 60)} mins
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Gas Fee</span>
                <span className="text-foreground font-bold">
                  ${quote.cost.gasCost.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bridge Fee</span>
                <span className="text-foreground font-bold">
                  ${quote.cost.protocolFees.toFixed(2)}
                </span>
              </div>
              {quote.cost.priceImpact > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Price Impact</span>
                  <span className="text-foreground font-bold">
                    {quote.cost.priceImpact.toFixed(2)}%
                  </span>
                </div>
              )}
              <div className="border-border flex items-center justify-between border-t pt-2">
                <span className="text-muted-foreground">Total Cost</span>
                <span className="text-lg font-bold text-orange-500">
                  ${quote.cost.total.toFixed(2)}
                </span>
              </div>
              <div className="text-muted-foreground text-xs">
                Via {quote.route.steps.map((s) => s.tool).join(" → ")}
              </div>
            </div>
          )
        )}

        {/* Action Button */}
        <Button
          className="h-14 w-full rounded-xl text-lg font-bold shadow-lg transition-all hover:scale-[1.02]"
          disabled={!inputAmount || !destAddress || !!addressError || loading}
          onClick={() =>
            executeBridge(
              inputAmount,
              inputToken.symbol,
              getChainName(sourceChain),
              getChainName(destChain),
            )
          }
        >
          {loading ? "Processing..." : "Bridge Assets"}
        </Button>
      </CardContent>
    </Card>
  )
}
