import { describe, it, expect, beforeEach, vi } from "vitest"

// idb is IndexedDB-backed; mock it so cache logic is tested in isolation.
const store = new Map<string, unknown>()
vi.mock("@alixex/storage", () => ({
  idbSet: vi.fn(async (k: string, v: unknown) => void store.set(k, v)),
  idbValues: vi.fn(async () => [...store.values()]),
}))

import { cachedAssets, cacheAsset } from "./cache"
import type { AssetRecord } from "./storage"

const rec = (txId: string, owner: string, chain: "arweave" | "irys" = "arweave"): AssetRecord => ({
  txId, fileName: txId, contentType: "text/plain", size: 1, timestamp: 1, chain,
  url: "u", owner,
})

describe("cachedAssets(owner)", () => {
  beforeEach(() => store.clear())

  it("returns all records when no owner is given", async () => {
    await cacheAsset(rec("a", "OWNER1"))
    await cacheAsset(rec("b", "OWNER2"))
    expect((await cachedAssets()).length).toBe(2)
  })

  it("filters by owner when given", async () => {
    await cacheAsset(rec("a", "OWNER1"))
    await cacheAsset(rec("b", "OWNER2"))
    const mine = await cachedAssets("OWNER1")
    expect(mine.map((r) => r.txId)).toEqual(["a"])
  })
})
