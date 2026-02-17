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

export function TokenBalances({
  address,
  chain,
  isUnlocked,
}: TokenBalancesProps) {
  const { t } = useTranslation()
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [loading, setLoading] = useState(false)

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

  const fetchBalances = async () => {
    if (!isUnlocked || !address) return

    setLoading(true)

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
    } catch (err: any) {
      console.error("Failed to fetch token balances:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (
      isUnlocked &&
      address &&
      ["ethereum", "solana", "sui"].includes(chain)
    ) {
      fetchBalances()
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
    <div className="mt-2 flex flex-wrap gap-2">
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
  )
}
