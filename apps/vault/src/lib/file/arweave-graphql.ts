import { RPCs } from "@alixex/chain-constants"

const GRAPHQL_GATEWAYS = [
  RPCs.ARWEAVE_GATEWAY, // https://arweave.net/graphql
  "https://ar-io.net/graphql",
  "https://turbo.ardrive.io/graphql",
  "https://goldsky.mainnet.arweave.dev/graphql",
] as const

export interface GraphQLRequest {
  query: string
  variables?: Record<string, any>
}

/**
 * Perform a GraphQL query with failover across multiple Arweave gateways.
 */
export async function queryArweaveGraphQL<T = any>(
  request: GraphQLRequest,
  options: { timeout?: number; maxRetriesPerGateway?: number } = {},
): Promise<T> {
  const { timeout = 15000, maxRetriesPerGateway = 1 } = options
  let lastError: Error | null = null

  for (const gateway of GRAPHQL_GATEWAYS) {
    for (let retry = 0; retry <= maxRetriesPerGateway; retry++) {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), timeout)

      try {
        const response = await fetch(gateway, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: controller.signal,
        })

        clearTimeout(id)

        if (!response.ok) {
          throw new Error(`Gateway ${gateway} returned ${response.status}`)
        }

        const result = await response.json()
        if (result.errors?.length) {
          throw new Error(
            `GraphQL Errors from ${gateway}: ${result.errors[0].message}`,
          )
        }

        return result.data as T
      } catch (err: any) {
        clearTimeout(id)
        lastError = err
        console.warn(
          `GraphQL query to ${gateway} failed (attempt ${retry + 1}):`,
          err.message,
        )

        // If it's a network error or timeout, we might want to try the next gateway immediately
        // but if it's a malformed query error, retrying won't help.
        // For simplicity, we just continue the loop.
      }
    }
  }

  throw lastError || new Error("All GraphQL gateways failed")
}
