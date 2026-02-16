/**
 * Token balances display component - Multi-chain support
 * Shows token balances for Ethereum (ERC20), Solana (SPL), and Sui networks
 */

import { useState, useEffect } from "react"
import {
  createEvmProvider,
  createEvmContract,
  createSolanaConnection,
  createSolanaPublicKey,
  createSuiClient,
} from "@aryxn/wallet-core"
import { Eye, EyeOff, RefreshCw, TrendingUp, Coins } from "lucide-react"
import {
  SUPPORTED_TOKENS,
  formatTokenAmount,
} from "@/lib/contracts/token-config"
import { SOLANA_TOKENS, formatSolanaTokenAmount } from "@/lib/chain"
import { SUI_TOKENS, formatSuiTokenAmount } from "@/lib/chain"
import { ERC20_ABI } from "@/lib/contracts/multi-hop-swapper-abi"
import { useTranslation } from "@/i18n/config"

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

const ETHEREUM_RPC = "https://eth.llamarpc.com"
const SOLANA_RPC = "https://api.mainnet-beta.solana.com"

export function TokenBalances({
  address,
  chain,
  isUnlocked,
}: TokenBalancesProps) {
  const { t } = useTranslation()
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [loading, setLoading] = useState(false)
  const [showBalances, setShowBalances] = useState(false)
  const [error, setError] = useState<string>("")

  const fetchEthereumBalances = async () => {
    const provider = createEvmProvider(ETHEREUM_RPC)
    const tokenBalances: TokenBalance[] = []

    // Fetch native ETH balance first
    try {
      const ethBalance = await provider.getBalance(address)
      tokenBalances.push({
        symbol: "ETH",
        name: "Ethereum",
        balance: ethBalance,
        formatted: formatTokenAmount(ethBalance, 18, 4),
        decimals: 18,
      })
    } catch (err) {
      console.error(`Failed to fetch ETH balance:`, err)
      tokenBalances.push({
        symbol: "ETH",
        name: "Ethereum",
        balance: 0n,
        formatted: "0",
        decimals: 18,
      })
    }

    // Fetch ERC20 token balances
    for (const token of SUPPORTED_TOKENS) {
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
          formatted: formatTokenAmount(balanceBigInt, token.decimals, 4),
          decimals: token.decimals,
        })
      } catch (err) {
        console.error(`Failed to fetch ${token.symbol} balance:`, err)
        tokenBalances.push({
          symbol: token.symbol,
          name: token.name,
          balance: 0n,
          formatted: "0",
          decimals: token.decimals,
        })
      }
    }

    return tokenBalances
  }

  const fetchSolanaBalances = async () => {
    const connection = createSolanaConnection(SOLANA_RPC)
    const publicKey = createSolanaPublicKey(address)
    const tokenBalances: TokenBalance[] = []

    for (const token of SOLANA_TOKENS) {
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
          formatted: formatSolanaTokenAmount(balance, token.decimals, 4),
          decimals: token.decimals,
        })
      } catch (err) {
        console.error(`Failed to fetch ${token.symbol} balance:`, err)
        tokenBalances.push({
          symbol: token.symbol,
          name: token.name,
          balance: 0n,
          formatted: "0",
          decimals: token.decimals,
        })
      }
    }

    return tokenBalances
  }

  const fetchSuiBalances = async () => {
    const client = createSuiClient("mainnet")
    const tokenBalances: TokenBalance[] = []

    for (const token of SUI_TOKENS) {
      try {
        // Get all coins of this type owned by the address
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
          formatted: formatSuiTokenAmount(totalBalance, token.decimals, 4),
          decimals: token.decimals,
        })
      } catch (err) {
        console.error(`Failed to fetch ${token.symbol} balance:`, err)
        tokenBalances.push({
          symbol: token.symbol,
          name: token.name,
          balance: 0n,
          formatted: "0",
          decimals: token.decimals,
        })
      }
    }

    return tokenBalances
  }

  const fetchBalances = async () => {
    if (!isUnlocked || !address) return

    setLoading(true)
    setError("")

    try {
      let tokenBalances: TokenBalance[] = []

      if (chain === "ethereum") {
        tokenBalances = await fetchEthereumBalances()
      } else if (chain === "solana") {
        tokenBalances = await fetchSolanaBalances()
      } else if (chain === "sui") {
        tokenBalances = await fetchSuiBalances()
      } else {
        // Other chains not supported yet
        setBalances([])
        return
      }

      setBalances(tokenBalances)
    } catch (err: any) {
      console.error("Failed to fetch token balances:", err)
      setError(err.message || "Failed to fetch balances")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (showBalances && isUnlocked) {
      fetchBalances()
    }
  }, [showBalances, isUnlocked, address, chain])

  // Don't show for unsupported chains
  if (!isUnlocked || !["ethereum", "solana", "sui"].includes(chain)) return null

  const nonZeroBalances = balances.filter((b) => b.balance > 0n)
  const hasTokens = nonZeroBalances.length > 0

  return (
    <div className="mt-4">
      {/* Header */}
      <div
        className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${
          showBalances
            ? "border-border bg-card shadow-md"
            : "border-border bg-secondary/50 hover:border-ring hover:bg-secondary"
        }`}
      >
        <button
          onClick={() => setShowBalances(!showBalances)}
          className="w-full p-3 text-left transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  showBalances
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-muted-foreground group-hover:bg-muted"
                }`}
              >
                {showBalances ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <Coins className="h-4 w-4" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      showBalances ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {t("identities.tokenAssets")}
                  </span>
                  {showBalances && hasTokens && (
                    <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[10px] font-bold">
                      {nonZeroBalances.length}
                    </span>
                  )}
                </div>
                {showBalances && (
                  <p className="text-muted-foreground text-xs">
                    {chain === "ethereum"
                      ? "ERC20"
                      : chain === "solana"
                        ? "SPL"
                        : "Sui"}{" "}
                    {t("identities.tokenAssets")}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {showBalances && !loading && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    fetchBalances()
                  }}
                  className="text-foreground hover:bg-accent rounded-lg p-1.5 transition-all"
                  aria-label={t("identities.refreshBalance")}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
              <div
                className={`rounded-lg p-1.5 transition-all ${
                  showBalances
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                {showBalances ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </div>
            </div>
          </div>
        </button>

        {/* Content */}
        {showBalances && (
          <div className="border-border border-t p-3">
            {loading && balances.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <RefreshCw className="text-foreground mr-2 h-4 w-4 animate-spin" />
                <span className="text-muted-foreground text-xs">
                  {t("common.loading")}…
                </span>
              </div>
            ) : error ? (
              <div className="bg-destructive/10 rounded-lg p-3 text-center">
                <p className="text-destructive text-xs">{error}</p>
              </div>
            ) : balances.length > 0 ? (
              <div className="space-y-2">
                {hasTokens ? (
                  <div className="grid grid-cols-1 gap-2">
                    {nonZeroBalances.map((token) => (
                      <div
                        key={token.symbol}
                        className="group/token border-border bg-card hover:border-ring flex items-center justify-between rounded-lg border p-2.5 transition-all hover:shadow-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold shadow-sm">
                            {token.symbol.slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-foreground text-xs font-semibold">
                              {token.symbol}
                            </div>
                            <div className="text-muted-foreground truncate text-[10px]">
                              {token.name}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-foreground text-sm font-bold">
                            {token.formatted}
                          </div>
                          <div className="text-muted-foreground text-[10px] font-medium">
                            {token.symbol}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="bg-secondary mb-2 flex h-12 w-12 items-center justify-center rounded-full">
                      <Coins className="text-muted-foreground h-6 w-6" />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {t("identities.noTokens")}
                    </p>
                  </div>
                )}
                {balances.length > nonZeroBalances.length && (
                  <div className="bg-secondary mt-2 rounded-lg px-2 py-1.5 text-center">
                    <p className="text-muted-foreground text-[10px]">
                      {balances.length - nonZeroBalances.length}{" "}
                      {t("identities.hiddenZeroBalance")}
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
