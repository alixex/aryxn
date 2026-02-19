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
import { useTranslation } from "@/i18n/config"
import { cn } from "@/lib/utils"

import { useBridgeHistory } from "@/lib/store/bridge-history"
import { useBridge } from "@/hooks/useBridge"

import { useState, useEffect } from "react"
import { useWallet } from "@/hooks/account-hooks"

const SYNC_CHAINS = ["ethereum", "solana", "bitcoin", "arweave", "sui"]

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

function getExplorerTxUrl(chain: string | undefined, hash: string) {
  if (!hash) return null

  if (!chain) {
    return `https://blockchair.com/search?q=${encodeURIComponent(hash)}`
  }

  const normalizedChain = chain.toLowerCase()

  switch (normalizedChain) {
    case "ethereum":
    case "eth":
      return `https://etherscan.io/tx/${hash}`
    case "solana":
    case "sol":
      return `https://solscan.io/tx/${hash}`
    case "bitcoin":
    case "btc":
      return `https://mempool.space/tx/${hash}`
    case "arweave":
    case "ar":
      return `https://arweave.net/tx/${hash}`
    case "sui":
      return `https://suiscan.xyz/mainnet/tx/${hash}`
    default:
      return `https://blockchair.com/search?q=${encodeURIComponent(hash)}`
  }
}

function isKnownExplorerChain(chain: string | undefined) {
  if (!chain) return false

  const normalizedChain = chain.toLowerCase()
  return [
    "ethereum",
    "eth",
    "solana",
    "sol",
    "bitcoin",
    "btc",
    "arweave",
    "ar",
    "sui",
  ].includes(normalizedChain)
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
  const { transactions, syncing, syncWithChain } = useBridgeHistory()
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null)

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

  const toggleDetails = (txId: string) => {
    setExpandedTxId((prev) => (prev === txId ? null : txId))
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

      <div className="max-h-100 space-y-1.5 overflow-y-auto p-2">
        {transactions.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            {t("dex.noHistory", "No recent transactions")}
          </div>
        ) : (
          transactions.map((tx) => {
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

                    <span className="max-w-[180px] truncate">
                      {tx.description}
                    </span>

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
                    <div className="text-muted-foreground break-words">
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
