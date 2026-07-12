import { describe, it, expect } from "vitest"
import { usageFor } from "./balances"
import type { AssetRecord } from "./storage"

const rec = (size: number): AssetRecord => ({
  txId: String(size),
  fileName: "f",
  contentType: "t",
  size,
  timestamp: 1,
  chain: "arweave",
  url: "u",
  owner: "O",
})

describe("usageFor", () => {
  it("counts files and sums bytes", () => {
    expect(usageFor([rec(100), rec(400)])).toEqual({
      count: 2,
      totalBytes: 500,
    })
  })
  it("handles empty", () => {
    expect(usageFor([])).toEqual({ count: 0, totalBytes: 0 })
  })
})
