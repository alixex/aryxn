import { useState, useMemo, useCallback } from "react"
import { useConnection, useChainId } from "wagmi"
import { ExchangeSDK } from "@aryxn/exchange-chain"
import type { ExchangeRequest, ExchangeRoute } from "@aryxn/exchange-chain"
import { getSwapperAddress, TOKEN_MAPPING } from "@/lib/contracts/addresses"

// Constants for Solana (should be move to a better config file later)
const SOLANA_PROGRAM_ID = "G2qM2J683JFYibZZCTefyX2W8YT9TRp5npyqm9ddtgHv"

export function useExchange() {
  const chainId = useChainId()
  const { address } = useConnection()

  const sdk = useMemo(() => {
    return new ExchangeSDK({
      ethereumContractAddress: getSwapperAddress(chainId),
      solanaProgramId: SOLANA_PROGRAM_ID,
      tokenMappings: TOKEN_MAPPING as any,
    })
  }, [chainId])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [route, setRoute] = useState<ExchangeRoute | null>(null)

  const getQuote = useCallback(
    async (params: Omit<ExchangeRequest, "recipient">) => {
      setLoading(true)
      setError(null)
      try {
        const exchangeRoute = await sdk.router.getRoute({
          ...params,
          recipient: address || undefined,
        })
        setRoute(exchangeRoute)
        return exchangeRoute
      } catch (err: any) {
        setError(err.message || "Failed to get quote")
        return null
      } finally {
        setLoading(false)
      }
    },
    [sdk, address],
  )

  const executeExchange = useCallback(async (selectedRoute: ExchangeRoute) => {
    setLoading(true)
    setError(null)
    try {
      // Logic for execution will depend on the type of route
      // For now, this is a placeholder for the integration with wallet-core
      console.log("Executing exchange:", selectedRoute)

      if (selectedRoute.type === "SWAP") {
        // Same-chain swap execution
      } else {
        // Cross-chain bridge execution
      }

      return true
    } catch (err: any) {
      setError(err.message || "Exchange failed")
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    sdk,
    loading,
    error,
    route,
    getQuote,
    executeExchange,
  }
}
