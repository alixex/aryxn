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
import type { RecoveryAction } from "@aryxn/cross-chain"
import {
  AppSyncChains,
  getExplorerTxUrl,
  isKnownExplorerChain,
} from "@aryxn/chain-constants"
import { useTranslation } from "@/i18n/config"
import { cn } from "@/lib/utils"
import { useBridgeHistory } from "@/lib/store/bridge-history"
import { useBridge } from "@/hooks/useBridge"
import { useState, useEffect, useMemo } from "react"
import { useWallet } from "@/hooks/account-hooks"
import { Button } from "@/components/ui/button"

const SYNC_CHAINS = AppSyncChains
type HistoryFilter = "ALL" | "SWAP" | "BRIDGE" | "SEND"

function formatRelativeTime(timestamp: number) {
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000))

  if (seconds < 60) return `${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function shortHash(hash: string) {
  if (hash.length <= 12) return hash
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

function statusLabel(status: "PENDING" | "COMPLETED" | "FAILED") {
  if (status === "PENDING") return "Pending"
  if (status === "COMPLETED") return "Completed"
  return "Failed"
}

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
  const [suggestedActions, setSuggestedActions] = useState<RecoveryAction[]>([])
  const [recommended, setRecommended] = useState<RecoveryAction | null>(null)

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
        } else {
          setSuggestedActions([])
          setRecommended(null)
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
    <div className="mt-1 flex flex-wrap gap-1">
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
  const {
    transactions,
    syncing,
    syncWithChain,
    loadTransactions,
    loaded,
    getSyncCooldownLeft,
  } = useBridgeHistory()
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null)
  const [filter, setFilter] = useState<HistoryFilter>("ALL")
  const [cooldownLeftMs, setCooldownLeftMs] = useState(0)

  const address = wallet.active.evm?.address

  // Load persisted history from storage database on mount
  useEffect(() => {
    if (!loaded) {
      void loadTransactions()
    }
  }, [loadTransactions, loaded])

  useEffect(() => {
    if (!address) {
      setCooldownLeftMs(0)
      return
    }

    let active = true

    const refreshCooldown = async () => {
      const left = await getSyncCooldownLeft(address)
      if (active) {
        setCooldownLeftMs(left)
      }
    }

    void refreshCooldown()
    const timer = setInterval(() => {
      void refreshCooldown()
    }, 1000)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [address, getSyncCooldownLeft, syncing])

  const handleRefresh = async () => {
    if (cooldownLeftMs > 0) return

    if (address) {
      for (const chain of SYNC_CHAINS) {
        await syncWithChain(chain, address)
      }
      const left = await getSyncCooldownLeft(address)
      setCooldownLeftMs(left)
    }
  }

  const toggleDetails = (txId: string) => {
    setExpandedTxId((prev) => (prev === txId ? null : txId))
  }

  const filteredTransactions = useMemo(() => {
    if (filter === "ALL") return transactions
    return transactions.filter((tx) => tx.type === filter)
  }, [transactions, filter])

  const filterCounts = useMemo(
    () => ({
      ALL: transactions.length,
      SWAP: transactions.filter((tx) => tx.type === "SWAP").length,
      BRIDGE: transactions.filter((tx) => tx.type === "BRIDGE").length,
      SEND: transactions.filter((tx) => tx.type === "SEND").length,
    }),
    [transactions],
  )

  return (
    <div className="glass-premium overflow-hidden rounded-xl border-none shadow-2xl">
      <div className="border-border/50 flex items-center justify-between border-b p-6">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <History className="h-5 w-5 text-cyan-400" />
          {t("dex.history", "Recent Activity")}
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleRefresh()}
          disabled={syncing || !address || cooldownLeftMs > 0}
          className={cn(
            "text-muted-foreground hover:bg-secondary/30 h-8 gap-1 rounded-full px-3 transition-colors hover:text-cyan-400",
            (syncing || cooldownLeftMs > 0) && "text-cyan-400",
          )}
          title={t("history.syncFromArweave", "Sync")}
        >
          <RotateCw className={cn("h-4 w-4", syncing && "animate-spin")} />
          {syncing
            ? t("history.syncing", "Syncing")
            : cooldownLeftMs > 0
              ? t("history.syncCooldown", "Sync ({{seconds}}s)", {
                  seconds: Math.ceil(cooldownLeftMs / 1000),
                })
              : t("history.syncFromArweave", "Sync")}
        </Button>
      </div>

      <div className="max-h-100 space-y-1.5 overflow-y-auto p-2">
        <div className="mb-2 flex flex-wrap gap-2 px-1">
          {[
            {
              value: "ALL" as const,
              label: t("common.all", "全部"),
              count: filterCounts.ALL,
            },
            {
              value: "SWAP" as const,
              label: t("dex.swap", "交换"),
              count: filterCounts.SWAP,
            },
            {
              value: "BRIDGE" as const,
              label: t("dex.bridge", "跨链"),
              count: filterCounts.BRIDGE,
            },
            {
              value: "SEND" as const,
              label: t("dex.transfer", "发送"),
              count: filterCounts.SEND,
            },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-all duration-200",
                filter === item.value
                  ? "bg-secondary text-foreground scale-[1.03]"
                  : "text-muted-foreground hover:bg-secondary/40",
              )}
            >
              <span>{item.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                  filter === item.value
                    ? "bg-foreground/10 text-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {item.count}
              </span>
            </button>
          ))}
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            {t("dex.noHistory", "No recent transactions")}
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const isExpanded = expandedTxId === tx.id
            const explorerUrl = tx.hash
              ? getExplorerTxUrl(tx.fromChain, tx.hash)
              : null
            const explorerLabel = isKnownExplorerChain(tx.fromChain)
              ? t("dex.openExplorer", "Open Explorer")
              : t("dex.searchTx", "Search Tx")
            const amountLabel = tx.amount
              ? tx.token
                ? `${tx.amount} ${tx.token}`
                : tx.amount
              : tx.token
                ? tx.token
                : null

            return (
              <div
                key={tx.id}
                className="group hover:bg-secondary/50 cursor-default rounded-xl p-2.5 transition-all"
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => toggleDetails(tx.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      toggleDetails(tx.id)
                    }
                  }}
                  className="focus-visible:ring-primary/40 cursor-pointer rounded-md outline-none focus-visible:ring-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {tx.status === "PENDING" && (
                        <Clock className="h-3.5 w-3.5 animate-pulse text-blue-400" />
                      )}
                      {tx.status === "COMPLETED" && (
                        <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                      )}
                      {tx.status === "FAILED" && (
                        <XCircle className="h-3.5 w-3.5 text-red-400" />
                      )}

                      <span
                        className={cn(
                          "text-[10px] font-semibold",
                          tx.status === "PENDING" && "text-blue-400",
                          tx.status === "COMPLETED" && "text-green-400",
                          tx.status === "FAILED" && "text-red-400",
                        )}
                      >
                        {statusLabel(tx.status)}
                      </span>

                      <span
                        className={cn(
                          "bg-secondary text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                          tx.type === "BRIDGE" &&
                            "bg-purple-500/10 text-purple-400",
                          tx.type === "SWAP" && "bg-blue-500/10 text-blue-400",
                          tx.type === "SEND" &&
                            "bg-orange-500/10 text-orange-400",
                        )}
                      >
                        {tx.type}
                      </span>

                      {amountLabel && (
                        <span className="text-foreground truncate text-xs font-semibold">
                          {amountLabel}
                        </span>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-muted-foreground text-[10px] font-medium">
                        {formatRelativeTime(tx.timestamp)}
                      </div>
                      {tx.lastUpdate && tx.status === "PENDING" && (
                        <div className="text-muted-foreground text-[9px] italic">
                          Updated{" "}
                          {Math.floor((Date.now() - tx.lastUpdate) / 1000)}s
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-5 text-[10px]">
                    {tx.fromChain && tx.toChain && (
                      <span>
                        {tx.fromChain} → {tx.toChain}
                      </span>
                    )}

                    {tx.hash && <span>{shortHash(tx.hash)}</span>}

                    <span className="max-w-45 truncate">{tx.description}</span>

                    {explorerUrl && (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-0.5 hover:text-cyan-400"
                      >
                        {explorerLabel} <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleDetails(tx.id)
                      }}
                      className="hover:text-foreground text-muted-foreground transition-colors"
                    >
                      {isExpanded
                        ? t("dex.hide", "Hide")
                        : t("dex.details", "Details")}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-secondary/30 mt-1 space-y-1 rounded-md p-2 pl-5 text-[10px]">
                    <div className="text-muted-foreground wrap-break-word">
                      {tx.description}
                    </div>
                    {tx.hash && (
                      <div className="text-muted-foreground break-all">
                        {tx.hash}
                      </div>
                    )}
                  </div>
                )}

                {(tx.type === "BRIDGE" || tx.status === "FAILED") &&
                  tx.hash &&
                  tx.fromChain &&
                  tx.toChain && (
                    <div className="pl-5">
                      {tx.type === "BRIDGE" && tx.status === "PENDING" && (
                        <BridgeRefreshButton
                          txHash={tx.hash}
                          fromChain={tx.fromChain}
                          toChain={tx.toChain}
                        />
                      )}

                      {tx.type === "BRIDGE" &&
                        (tx.status === "FAILED" || tx.status === "PENDING") && (
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
                  )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
