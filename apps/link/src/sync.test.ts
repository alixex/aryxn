import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the IO/network seams so the sync orchestration is tested in isolation.
const h = vi.hoisted(() => ({
  idbGet: vi.fn(),
  idbSet: vi.fn(),
  listArweaveByOwner: vi.fn(),
  listIrysByOwner: vi.fn(),
  fetchIrysSize: vi.fn(),
  cacheAssets: vi.fn(),
  isCached: vi.fn(),
}))
vi.mock("@alixex/storage", () => ({ idbGet: h.idbGet, idbSet: h.idbSet }))
vi.mock("./storage", () => ({
  listArweaveByOwner: h.listArweaveByOwner,
  listIrysByOwner: h.listIrysByOwner,
  fetchIrysSize: h.fetchIrysSize,
}))
vi.mock("./cache", () => ({ cacheAssets: h.cacheAssets, isCached: h.isCached }))

import { syncArweaveAssets, syncIrysAssets } from "./sync"

beforeEach(() => vi.clearAllMocks())

describe("sync watermark guard (#3)", () => {
  it("passes a still-cached watermark as `until` and advances it", async () => {
    h.idbGet.mockResolvedValue("WM")
    h.isCached.mockResolvedValue(true)
    h.listArweaveByOwner.mockResolvedValue([{ txId: "new1", size: 1 }])

    await syncArweaveAssets("ADDR")

    expect(h.listArweaveByOwner).toHaveBeenCalledWith("ADDR", { until: "WM" })
    expect(h.idbSet).toHaveBeenCalledWith("sync:arweave:ADDR", "new1")
  })

  it("ignores a watermark whose tx was evicted from cache (full re-scan)", async () => {
    h.idbGet.mockResolvedValue("WM")
    h.isCached.mockResolvedValue(false) // evicted
    h.listArweaveByOwner.mockResolvedValue([])

    await syncArweaveAssets("ADDR")

    expect(h.listArweaveByOwner).toHaveBeenCalledWith("ADDR", {
      until: undefined,
    })
    expect(h.idbSet).not.toHaveBeenCalled() // nothing fresh → watermark unchanged
  })
})

describe("sync Irys size backfill (#1)", () => {
  it("fills size=0 records via a HEAD before caching", async () => {
    h.idbGet.mockResolvedValue(undefined)
    h.isCached.mockResolvedValue(false)
    const rec = { txId: "ir1", size: 0 }
    h.listIrysByOwner.mockResolvedValue([rec])
    h.fetchIrysSize.mockResolvedValue(4096)

    await syncIrysAssets("EVM")

    expect(h.fetchIrysSize).toHaveBeenCalledWith("ir1")
    expect(rec.size).toBe(4096) // mutated in place
    expect(h.cacheAssets).toHaveBeenCalledWith([rec])
  })
})
