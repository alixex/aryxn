// apps/web/src/hooks/bridge-hooks/use-lifi-route.ts

import { useEffect, useState, useCallback } from "react"
import { useDebounce } from "use-debounce"
import { getLiFiClient } from "@/lib/bridge/lifi-client"
import type { LiFiRoute, LiFiRouteRequest } from "@/lib/bridge/route-types"
import { mapBridgeError } from "@/lib/bridge/bridge-errors"

interface UseLiFiRouteParams {
  enabled?: boolean
  debounceMs?: number
}

interface UseLiFiRouteResult {
  routes: LiFiRoute[]
  bestRoute: LiFiRoute | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// Simple in-memory cache (can be upgraded to use React Query)
const routeCache = new Map<string, { route: LiFiRoute; timestamp: number }>()
const CACHE_TTL = 60000 // 60 seconds

function getCacheKey(request: LiFiRouteRequest): string {
  return `${request.fromChain}:${request.fromToken}:${request.fromAmount}:${request.toChain}:${request.toToken}`
}

function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL
}

/**
 * Hook to query Li.Fi routes with debounce and caching
 */
export function useLiFiRoute(
  request: LiFiRouteRequest | null,
  params: UseLiFiRouteParams = {},
): UseLiFiRouteResult {
  const { enabled = true, debounceMs = 500 } = params

  const [routes, setRoutes] = useState<LiFiRoute[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [debouncedRequest] = useDebounce(request, debounceMs)

  const refetch = useCallback(async () => {
    if (!request || !enabled) return

    const cacheKey = getCacheKey(request)
    const cached = routeCache.get(cacheKey)

    if (cached && isCacheValid(cached.timestamp)) {
      setRoutes([cached.route])
      setError(null)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const client = getLiFiClient()
      const fetchedRoutes = await client.getRoutes(request)

      if (fetchedRoutes.length > 0) {
        // Cache the best route (first one is usually best)
        routeCache.set(cacheKey, {
          route: fetchedRoutes[0],
          timestamp: Date.now(),
        })
      }

      setRoutes(fetchedRoutes)
    } catch (err) {
      const mapped = mapBridgeError(err)
      setError(mapped.message)
      setRoutes([])
    } finally {
      setLoading(false)
    }
  }, [request, enabled])

  useEffect(() => {
    if (!debouncedRequest || !enabled) {
      setRoutes([])
      return
    }

    refetch()
  }, [debouncedRequest, enabled, refetch])

  return {
    routes,
    bestRoute: routes.length > 0 ? routes[0] : null,
    loading,
    error,
    refetch,
  }
}
