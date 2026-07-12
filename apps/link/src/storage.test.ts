import { describe, it, expect, vi, afterEach } from "vitest"
import { encryptFile, decryptAsset, listArweaveByOwner } from "./storage"

afterEach(() => vi.unstubAllGlobals())

describe("encrypt envelope (P0: no on-chain filename leak)", () => {
  it("carries name/type inside the ciphertext and recovers them on decrypt", async () => {
    const file = new File([new TextEncoder().encode("hello world")], "secret.pdf", {
      type: "application/pdf",
    })
    const { data, keyB64 } = await encryptFile(file)

    // The blob is opaque bytes — the plaintext name must not appear in it.
    expect(new TextDecoder().decode(data)).not.toContain("secret.pdf")

    // decryptAsset fetches the blob from the gateway; mock that fetch.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => data.buffer })),
    )
    const out = await decryptAsset("arweave", "TX", encodeURIComponent(keyB64))
    expect(out.fileName).toBe("secret.pdf")
    expect(out.contentType).toBe("application/pdf")
    expect(new TextDecoder().decode(out.bytes)).toBe("hello world")
  })
})

describe("listArweaveByOwner (P1: pagination + watermark)", () => {
  const edge = (id: string) => ({
    cursor: `cur-${id}`,
    node: { id, tags: [], data: { size: "1" }, block: { timestamp: 1 } },
  })
  const page = (
    edges: ReturnType<typeof edge>[],
    hasNextPage: boolean,
  ) => ({
    ok: true,
    json: async () => ({
      data: { transactions: { pageInfo: { hasNextPage }, edges } },
    }),
  })

  it("paginates past the first page until hasNextPage is false", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page([edge("a"), edge("b")], true))
      .mockResolvedValueOnce(page([edge("c")], false))
    vi.stubGlobal("fetch", fetchMock)

    const recs = await listArweaveByOwner("ADDR", { pageSize: 2 })
    expect(recs.map((r) => r.txId)).toEqual(["a", "b", "c"])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("stops at the watermark and skips the rest", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page([edge("a"), edge("b"), edge("c")], true))
    vi.stubGlobal("fetch", fetchMock)

    const recs = await listArweaveByOwner("ADDR", { until: "b" })
    expect(recs.map((r) => r.txId)).toEqual(["a"]) // stopped at "b"
    expect(fetchMock).toHaveBeenCalledTimes(1) // never fetched page 2
  })
})
