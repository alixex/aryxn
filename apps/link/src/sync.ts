// Incremental chain sync. Paginates the tag index newest-first and stops at the
// last synced tx (the per-(chain,address) watermark), caching only the fresh
// ones. Steady state ≈ 1 request; a cold start (no watermark) paginates the full
// history. See docs/resource-index-design.md.

import { idbGet, idbSet } from "@alixex/storage"
import {
  listArweaveByOwner,
  listIrysByOwner,
  type AssetRecord,
  type Chain,
  type ListOpts,
} from "./storage"
import { cacheAssets } from "./cache"

const wmKey = (chain: Chain, address: string) => `sync:${chain}:${address}`

async function syncChain(
  chain: Chain,
  address: string,
  list: (a: string, o: ListOpts) => Promise<AssetRecord[]>,
): Promise<void> {
  const until = await idbGet<string>(wmKey(chain, address))
  const fresh = await list(address, { until })
  if (fresh.length === 0) return // nothing new since last sync
  await cacheAssets(fresh)
  // Results are newest-first, so fresh[0] is the new high-water mark.
  await idbSet(wmKey(chain, address), fresh[0].txId)
}

export function syncArweaveAssets(address: string): Promise<void> {
  return syncChain("arweave", address, listArweaveByOwner)
}

export function syncIrysAssets(address: string): Promise<void> {
  return syncChain("irys", address, listIrysByOwner)
}
