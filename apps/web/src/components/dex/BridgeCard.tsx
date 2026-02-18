import { useState, useEffect } from "react"
import { Settings, Clock, RotateCw } from "lucide-react"
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

import { useBridgeHistory } from "@/lib/store/bridge-history"
import { toast } from "sonner"

// Mock Bridge Hook (will move to separate file later)
function useBridge() {
  const [loading, setLoading] = useState(false)
  const [quote, setQuote] = useState<any>(null)
  const addTransaction = useBridgeHistory((state) => state.addTransaction)

  const getQuote = async (
    _fromToken: string,
    _toToken: string,
    amount: string,
  ) => {
    if (!amount || parseFloat(amount) <= 0) return
    setLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setQuote({
      estimatedTime: 600, // seconds
      fee: "0.005 ETH",
      outputAmount: (parseFloat(amount || "0") * 0.98).toFixed(6),
    })
    setLoading(false)
  }

  const executeBridge = async (
    fromChain: string,
    toChain: string,
    token: string,
    amount: string,
  ) => {
    setLoading(true)
    // Simulate bridge execution
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const txId = "0x" + Math.random().toString(16).slice(2)
    addTransaction({
      id: crypto.randomUUID(),
      type: "BRIDGE",
      status: "PENDING",
      description: `Bridge ${amount} ${token} from ${fromChain} to ${toChain}`,
      timestamp: Date.now(),
      hash: txId,
      fromChain,
      toChain,
      amount,
      token,
    })

    toast.success("Bridge transaction initiated", {
      description: "You can track progress in the history panel.",
    })
    setLoading(false)
  }

  return { loading, quote, getQuote, executeBridge }
}

const CHAINS = [
  { id: "ethereum", name: "Ethereum", icon: "🔷" },
  { id: "solana", name: "Solana", icon: "◎" },
  { id: "bitcoin", name: "Bitcoin", icon: "₿" },
  { id: "arweave", name: "Arweave", icon: "🅰️" },
]

export function BridgeCard() {
  const { t } = useTranslation()

  const [sourceChain, setSourceChain] = useState("ethereum")
  const [destChain, setDestChain] = useState("solana")

  const [inputToken, setInputToken] = useState<TokenInfo>(SUPPORTED_TOKENS[0])
  const [inputAmount, setInputAmount] = useState("")

  const { loading, quote, getQuote, executeBridge } = useBridge()

  // Debounced quote fetching
  useEffect(() => {
    if (parseFloat(inputAmount) > 0) {
      const timer = setTimeout(() => {
        getQuote(inputToken.symbol, "SOL", inputAmount)
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [inputAmount, inputToken, sourceChain, destChain])

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
        {/* Source Chain Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              From Network
            </Label>
            <Select value={sourceChain} onValueChange={setSourceChain}>
              <SelectTrigger className="bg-secondary/50 border-input/50 h-12 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAINS.map((chain) => (
                  <SelectItem key={chain.id} value={chain.id}>
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
            <Select value={destChain} onValueChange={setDestChain}>
              <SelectTrigger className="bg-secondary/50 border-input/50 h-12 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAINS.map((chain) => (
                  <SelectItem key={chain.id} value={chain.id}>
                    <span className="mr-2">{chain.icon}</span> {chain.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Input Area */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label className="text-foreground text-sm font-semibold">
              Asset to Bridge
            </Label>
            <span className="text-muted-foreground text-xs">Balance: 0.00</span>
          </div>

          <div className="border-border bg-background focus-within:ring-ring/10 flex items-center gap-3 rounded-xl border-2 p-4 shadow-sm transition-all focus-within:ring-2">
            <Select
              value={inputToken.symbol}
              onValueChange={(symbol) => {
                const token = SUPPORTED_TOKENS.find((t) => t.symbol === symbol)
                if (token) setInputToken(token)
              }}
            >
              <SelectTrigger className="bg-secondary hover:bg-accent w-28 shrink-0 justify-center border-none px-3 py-2.5 font-bold shadow-none transition-colors">
                <SelectValue>{inputToken.symbol}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_TOKENS.map((token) => (
                  <SelectItem key={token.address} value={token.symbol}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground font-bold">
                        {token.symbol}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="bg-border h-10 w-px"></div>
            <Input
              type="number"
              placeholder="0.0"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className="min-w-0 flex-1 border-none bg-transparent px-2 text-right text-xl font-bold shadow-none focus-visible:ring-0 sm:text-2xl"
            />
          </div>
        </div>

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
                  ~{Math.ceil(quote.estimatedTime / 60)} mins
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Network Fee</span>
                <span className="text-foreground font-bold">{quote.fee}</span>
              </div>
              <div className="border-border flex items-center justify-between border-t pt-2">
                <span className="text-muted-foreground">You Receive</span>
                <span className="text-lg font-bold text-green-500">
                  {quote.outputAmount}{" "}
                  <span className="text-muted-foreground ml-1 text-xs">
                    SOL
                  </span>
                </span>
              </div>
            </div>
          )
        )}

        {/* Action Button */}
        <Button
          className="h-14 w-full rounded-xl text-lg font-bold shadow-lg transition-all hover:scale-[1.02]"
          disabled={!inputAmount || loading}
          onClick={() =>
            executeBridge(sourceChain, destChain, inputToken.symbol, inputAmount)
          }
        >
          {loading ? "Processing..." : "Bridge Assets"}
        </Button>
      </CardContent>
    </Card>
  )
}
