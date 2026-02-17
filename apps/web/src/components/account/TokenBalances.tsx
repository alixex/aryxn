/**
 * Token balances display component - Multi-chain support
 * Shows token balances for Ethereum (ERC20), Solana (SPL), and Sui networks
 * Simplified version: only shows USDT and USDC
 */

import { useState, useEffect } from "react"
import {
  createEvmProvider,
  createEvmContract,
  createSolanaConnection,
  createSolanaPublicKey,
  createSuiClient,
} from "@aryxn/wallet-core"
import { RefreshCw } from "lucide-react"
import {
  SUPPORTED_TOKENS,
  formatTokenAmount,
} from "@/lib/contracts/token-config"
import { SOLANA_TOKENS, formatSolanaTokenAmount } from "@/lib/chain"
import { SUI_TOKENS, formatSuiTokenAmount } from "@/lib/chain"
import { ERC20_ABI } from "@/lib/contracts/multi-hop-swapper-abi"
import { useTranslation } from "@/i18n/config"
import { getEthereumRpcUrl, getSolanaRpcUrl } from "@/lib/chain/rpc-config"
import { formatTimestamp } from "@/lib/utils"
import { toast } from "sonner"

interface TokenBalance {
  symbol: string
  name: string
  balance: bigint
  formatted: string
  decimals: number
}

interface TokenBalancesProps {
  address: string
  chain: string
  isUnlocked: boolean
}

// Global cache to prevent re-fetching across remounts
const globalFetchCache = new Map<string, number>()
const GLOBAL_COOLDOWN = 30000

export function TokenBalances({
  address,
  chain,
  isUnlocked,
}: TokenBalancesProps) {
  const { t } = useTranslation()
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const fetchEthereumBalances = async () => {
    const provider = createEvmProvider(getEthereumRpcUrl())
    const tokenBalances: TokenBalance[] = []

    // Only fetch USDT and USDC
    const filteredTokens = SUPPORTED_TOKENS.filter(
      (t) => t.symbol === "USDT" || t.symbol === "USDC",
    )

    for (const token of filteredTokens) {
      try {
        const tokenContract = createEvmContract(
          token.address,
          ERC20_ABI,
          provider,
        )
        const balance = await tokenContract.balanceOf(address)
        const balanceBigInt = BigInt(balance.toString())

        tokenBalances.push({
          symbol: token.symbol,
          name: token.name,
          balance: balanceBigInt,
          formatted: formatTokenAmount(balanceBigInt, token.decimals, 2), // Fewer decimals for compact view
          decimals: token.decimals,
        })
      } catch (err) {
        console.error(`Failed to fetch ${token.symbol} balance:`, err)
      }
    }

    return tokenBalances
  }

  const fetchSolanaBalances = async () => {
    const connection = createSolanaConnection(getSolanaRpcUrl())
    const publicKey = createSolanaPublicKey(address)
    const tokenBalances: TokenBalance[] = []

    // Only fetch USDT and USDC
    const filteredTokens = SOLANA_TOKENS.filter(
      (t) => t.symbol === "USDT" || t.symbol === "USDC",
    )

    for (const token of filteredTokens) {
      try {
        const mintPubkey = createSolanaPublicKey(token.mint)
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          publicKey,
          { mint: mintPubkey },
        )

        let balance = 0n
        if (tokenAccounts.value.length > 0) {
          const accountInfo = tokenAccounts.value[0].account.data.parsed.info
          balance = BigInt(accountInfo.tokenAmount.amount)
        }

        tokenBalances.push({
          symbol: token.symbol,
          name: token.name,
          balance,
          formatted: formatSolanaTokenAmount(balance, token.decimals, 2),
          decimals: token.decimals,
        })
      } catch (err) {
        console.error(`Failed to fetch ${token.symbol} balance:`, err)
      }
    }

    return tokenBalances
  }

  const fetchSuiBalances = async () => {
    const client = createSuiClient("mainnet")
    const tokenBalances: TokenBalance[] = []

    // Only fetch USDT and USDC
    const filteredTokens = SUI_TOKENS.filter(
      (t) => t.symbol === "USDT" || t.symbol === "USDC",
    )

    for (const token of filteredTokens) {
      try {
        const coins = await client.getCoins({
          owner: address,
          coinType: token.type,
        })

        let totalBalance = 0n
        for (const coin of coins.data) {
          totalBalance += BigInt(coin.balance)
        }

        tokenBalances.push({
          symbol: token.symbol,
          name: token.name,
          balance: totalBalance,
          formatted: formatSuiTokenAmount(totalBalance, token.decimals, 2),
          decimals: token.decimals,
        })
      } catch (err) {
        console.error(`Failed to fetch ${token.symbol} balance:`, err)
      }
    }

    return tokenBalances
  }

  const [backoffTime, setBackoffTime] = useState<number>(0)

  const fetchBalances = async (force = false) => {
    if (!isUnlocked || !address) return

    const cacheKey = `${chain}-${address}`
    const now = Date.now()
    const lastFetch = globalFetchCache.get(cacheKey) || 0
    const currentCooldown = GLOBAL_COOLDOWN + backoffTime

    // Antigravity: Global protection against remount loops
    if (!force && lastFetch > 0 && now - lastFetch < currentCooldown) {
      console.debug(
        `[TokenBalances] Skipping fetch for ${address}, global cooldown active (${Math.ceil((currentCooldown - (now - lastFetch)) / 1000)}s left)`,
      )
      return
    }

    setLoading(true)
    globalFetchCache.set(cacheKey, now) // Set immediately to block parallel mounts

    try {
      let tokenBalances: TokenBalance[] = []

      if (chain === "ethereum") {
        tokenBalances = await fetchEthereumBalances()
      } else if (chain === "solana") {
        tokenBalances = await fetchSolanaBalances()
      } else if (chain === "sui") {
        tokenBalances = await fetchSuiBalances()
      }

      setBalances(tokenBalances)
      setLastUpdated(Date.now())
      // Successful fetch resets backoff
      setBackoffTime(0)
    } catch (err: any) {
      console.error("Failed to fetch token balances:", err)

      // Antigravity: Handle 429 specifically with exponential backoff
      if (err?.message?.includes("429") || err?.status === 429) {
        setBackoffTime((prev) => Math.min(prev + 60000, 300000)) // Max 5 min backoff
        toast.error(
          t(
            "common.rateLimitError",
            "Rate limited by RPC provider. Retrying later...",
          ),
        )
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    if (
      isUnlocked &&
      address &&
      ["ethereum", "solana", "sui"].includes(chain)
    ) {
      if (active) fetchBalances()
    }
    return () => {
      active = false
    }
  }, [isUnlocked, address, chain])

  // Don't show for unsupported chains
  if (!isUnlocked || !["ethereum", "solana", "sui"].includes(chain)) return null

  const activeBalances = balances.filter((b) => b.balance > 0n)

  // If loading and no balances yet, show a subtle loading state
  if (loading && activeBalances.length === 0) {
    return (
      <div className="mt-2 flex items-center gap-2 opacity-50">
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span className="text-[10px] font-medium tracking-wider uppercase">
          {t("common.loading")}
        </span>
      </div>
    )
  }

  if (activeBalances.length === 0) return null

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {activeBalances.map((token) => (
          <div
            key={token.symbol}
            className="bg-secondary/30 border-border/50 hover:bg-secondary/50 flex items-center gap-2 rounded-lg border px-2 py-1 shadow-sm transition-all"
          >
            <div className="bg-primary/20 text-primary flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold">
              {token.symbol === "USDT" ? "T" : "C"}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-foreground text-xs leading-none font-bold">
                {token.formatted}
              </span>
              <span className="text-muted-foreground text-[9px] leading-none font-bold uppercase">
                {token.symbol}
              </span>
            </div>
          </div>
        ))}
        <button
          onClick={(e) => {
            e.stopPropagation()
            fetchBalances()
          }}
          className="text-muted-foreground hover:text-primary p-1 transition-colors"
          title={t("identities.refreshBalance")}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {lastUpdated && (
        <span className="text-muted-foreground/50 ml-1 text-[9px] font-medium">
          {formatTimestamp(lastUpdated)}
        </span>
      )}
    </div>
  )
}
