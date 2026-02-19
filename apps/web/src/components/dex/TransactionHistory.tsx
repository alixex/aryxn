import {
  History,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink,
  RotateCw,
  RefreshCw,
  Repeat,
  Zap,
  FileCheck,
} from "lucide-react"
import { useTranslation } from "@/i18n/config"
import { cn } from "@/lib/utils"

import { useBridgeHistory } from "@/lib/store/bridge-history"
import { useBridge } from "@/hooks/useBridge"

import { useState, useEffect } from "react"
import { useWallet } from "@/hooks/account-hooks"

const SYNC_CHAINS = ["ethereum", "solana", "bitcoin", "arweave", "sui"]

/**
 * Refresh button for bridge transactions
 */
function BridgeRefreshButton({
  txHash,
  fromChain,
  toChain,
}: {
  txHash: string
  fromChain: string
  toChain: string
}) {
  const { refreshTransactionStatus, getRemainingCooldown, canRefresh } =
    useBridge()
  const [cooldown, setCooldown] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  // Update cooldown every second
  useEffect(() => {
    const updateCooldown = () => {
      setCooldown(getRemainingCooldown(txHash))
    }

    updateCooldown()
    const interval = setInterval(updateCooldown, 1000)
    return () => clearInterval(interval)
  }, [txHash, getRemainingCooldown])

  const handleRefresh = async () => {
    if (!canRefresh(txHash) || refreshing) return

    setRefreshing(true)
    try {
      await refreshTransactionStatus(txHash, fromChain, toChain)
    } finally {
      setRefreshing(false)
    }
  }

  const isDisabled = !canRefresh(txHash) || refreshing

  return (
    <button
      onClick={handleRefresh}
      disabled={isDisabled}
      className={cn(
        "text-muted-foreground hover:bg-secondary/30 flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors",
        !isDisabled && "hover:text-cyan-400",
        refreshing && "animate-pulse text-cyan-400",
        isDisabled && "cursor-not-allowed opacity-50",
      )}
      title={cooldown > 0 ? `Wait ${cooldown}s` : "Refresh status"}
    >
      <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
      {cooldown > 0 && <span>{cooldown}s</span>}
    </button>
  )
}

/**
 * Recovery action buttons for failed/stuck bridge transactions
 */
function RecoveryActions({
  txId,
  txHash,
  fromChain,
  toChain,
  status,
  timestamp,
}: {
  txId: string
  txHash: string
  fromChain: string
  toChain: string
  status: string
  timestamp: number
}) {
  const {
    checkRecoveryOptions,
    retryTransaction,
    claimTransaction,
    speedUpTransaction,
  } = useBridge()
  const [checking, setChecking] = useState(false)
  const [suggestedActions, setSuggestedActions] = useState<string[]>([])
  const [recommended, setRecommended] = useState<string | null>(null)

  useEffect(() => {
    const checkOptions = async () => {
      setChecking(true)
      try {
        const result = await checkRecoveryOptions(
          txHash,
          fromChain,
          toChain,
          timestamp,
        )
        if (result.recoverable) {
          setSuggestedActions(result.suggestedActions)
          setRecommended(result.recommendations.recommended)
        }
      } catch (error) {
        console.error("Failed to check recovery options:", error)
      } finally {
        setChecking(false)
      }
    }

    checkOptions()
  }, [txHash, fromChain, toChain, timestamp, checkRecoveryOptions])

  if (checking || suggestedActions.length === 0) {
    return null
  }

  const handleRetry = () => {
    retryTransaction(txId, { increaseSlippage: true })
  }

  const handleClaim = () => {
    claimTransaction(txId, txHash, fromChain, toChain)
  }

  const handleSpeedUp = () => {
    speedUpTransaction(txId, txHash, { gasMultiplier: 1.2 })
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {suggestedActions.includes("RETRY") && (
        <button
          onClick={handleRetry}
          className={cn(
            "text-muted-foreground hover:bg-secondary/30 flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors hover:text-yellow-400",
            recommended === "RETRY" && "bg-yellow-500/10 text-yellow-400",
          )}
          title="Retry with new route"
        >
          <Repeat className="h-3 w-3" />
          Retry
        </button>
      )}

      {suggestedActions.includes("CLAIM") && (
        <button
          onClick={handleClaim}
          className={cn(
            "text-muted-foreground hover:bg-secondary/30 flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors hover:text-green-400",
            recommended === "CLAIM" && "bg-green-500/10 text-green-400",
          )}
          title="Claim stuck funds"
        >
          <FileCheck className="h-3 w-3" />
          Claim
        </button>
      )}

      {suggestedActions.includes("SPEED_UP") && (
        <button
          onClick={handleSpeedUp}
          className={cn(
            "text-muted-foreground hover:bg-secondary/30 flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors hover:text-cyan-400",
            recommended === "SPEED_UP" && "bg-cyan-500/10 text-cyan-400",
          )}
          title="Speed up with higher gas"
        >
          <Zap className="h-3 w-3" />
          Speed Up
        </button>
      )}
    </div>
  )
}

export function TransactionHistory() {
  const { t } = useTranslation()
  const wallet = useWallet()
  const { transactions, syncing, syncWithChain } = useBridgeHistory()

  const address = wallet.active.evm?.address

  // Auto-sync on mount / address change
  useEffect(() => {
    if (address) {
      SYNC_CHAINS.forEach((chain) => syncWithChain(chain, address))
    }
  }, [address, syncWithChain])

  const handleRefresh = () => {
    if (address) {
      SYNC_CHAINS.forEach((chain) => syncWithChain(chain, address))
    }
  }

  return (
    <div className="glass-premium overflow-hidden rounded-xl border-none shadow-2xl">
      <div className="border-border/50 flex items-center justify-between border-b p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <History className="h-5 w-5 text-cyan-400" />
          {t("dex.history", "Recent Activity")}
        </h3>
        <button
          onClick={handleRefresh}
          disabled={syncing || !address}
          className={cn(
            "text-muted-foreground hover:bg-secondary/30 rounded-full p-1 transition-colors hover:text-cyan-400",
            syncing && "animate-spin text-cyan-400",
          )}
          title="Refresh History"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-100 space-y-2 overflow-y-auto p-2">
        {transactions.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            {t("dex.noHistory", "No recent transactions")}
          </div>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="group hover:bg-secondary/50 cursor-default rounded-xl p-3 transition-all"
            >
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {tx.status === "PENDING" && (
                    <Clock className="h-4 w-4 animate-pulse text-blue-400" />
                  )}
                  {tx.status === "COMPLETED" && (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  )}
                  {tx.status === "FAILED" && (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span
                    className={cn(
                      "bg-secondary text-muted-foreground rounded-full px-2 py-0.5 text-xs font-bold",
                      tx.type === "BRIDGE" &&
                        "bg-purple-500/10 text-purple-400",
                      tx.type === "SWAP" && "bg-blue-500/10 text-blue-400",
                      tx.type === "SEND" && "bg-orange-500/10 text-orange-400",
                    )}
                  >
                    {tx.type}
                  </span>

                  {/* Refresh button for pending bridge transactions */}
                  {tx.type === "BRIDGE" &&
                    tx.status === "PENDING" &&
                    tx.hash &&
                    tx.fromChain &&
                    tx.toChain && (
                      <BridgeRefreshButton
                        txHash={tx.hash}
                        fromChain={tx.fromChain}
                        toChain={tx.toChain}
                      />
                    )}
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground text-[10px]">
                    {new Date(tx.timestamp).toLocaleDateString()}
                  </span>
                  {tx.lastUpdate && tx.status === "PENDING" && (
                    <div className="text-muted-foreground text-[9px] italic">
                      Updated {Math.floor((Date.now() - tx.lastUpdate) / 1000)}s
                      ago
                    </div>
                  )}
                </div>
              </div>

              <div className="pl-6">
                <p className="text-foreground text-sm font-medium">
                  {tx.description}
                </p>
                {tx.hash && (
                  <a
                    href="#"
                    className="text-muted-foreground mt-1 flex items-center gap-1 text-[10px] hover:text-cyan-400"
                  >
                    View on Explorer <ExternalLink className="h-3 w-3" />
                  </a>
                )}

                {/* Recovery actions for bridge transactions */}
                {tx.type === "BRIDGE" &&
                  (tx.status === "FAILED" || tx.status === "PENDING") &&
                  tx.hash &&
                  tx.fromChain &&
                  tx.toChain && (
                    <RecoveryActions
                      txId={tx.id}
                      txHash={tx.hash}
                      fromChain={tx.fromChain}
                      toChain={tx.toChain}
                      status={tx.status}
                      timestamp={tx.timestamp}
                    />
                  )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
