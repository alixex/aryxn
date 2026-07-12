// Local "my links" cache — IndexedDB (via @alixex/storage). The chain is the
// source of truth; this is just for instant, offline-friendly display.

import { idbSet, idbValues } from "@alixex/storage"
import type { AssetRecord } from "./storage"

const KEY = (txId: string) => `link:${txId}`

export async function cacheAsset(record: AssetRecord): Promise<void> {
  await idbSet(KEY(record.txId), record)
}

export async function cacheAssets(records: AssetRecord[]): Promise<void> {
  await Promise.all(records.map(cacheAsset))
}

export async function cachedAssets(): Promise<AssetRecord[]> {
  const all = await idbValues<AssetRecord>()
  return all
    .filter((v): v is AssetRecord => !!v && typeof v.txId === "string")
    .sort((a, b) => b.timestamp - a.timestamp)
}
