import { describe, it, expect, vi, afterEach } from "vitest"
import {
  encryptFile,
  decryptAsset,
  listArweaveByOwner,
  fetchIrysSize,
} from "./storage"

afterEach(() => vi.unstubAllGlobals())

describe("fetchIrysSize (P1 gap #2: HEAD Content-Length)", () => {
  it("returns the Content-Length as a number", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        headers: {
          get: (h: string) => (h === "content-length" ? "4096" : null),
        },
      })),
    )
    expect(await fetchIrysSize("TX")).toBe(4096)
  })

  it("returns 0 when the header is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ headers: { get: () => null } })),
    )
    expect(await fetchIrysSize("TX")).toBe(0)
  })
})

describe("encrypt envelope (P0: no on-chain filename leak)", () => {
  it("carries name/type inside the ciphertext and recovers them on decrypt", async () => {
    const file = new File(
      [new TextEncoder().encode("hello world")],
      "secret.pdf",
      {
        type: "application/pdf",
      },
    )
    const { data, payload } = await encryptFile(file)

    // The blob is opaque bytes — the plaintext name must not appear in it.
    expect(new TextDecoder().decode(data)).not.toContain("secret.pdf")

    // decryptAsset fetches the blob from the gateway; mock that fetch.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => data.buffer })),
    )
    const out = await decryptAsset("arweave", "TX", encodeURIComponent(payload))
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
  const page = (edges: ReturnType<typeof edge>[], hasNextPage: boolean) => ({
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

function stubFetch(body: Uint8Array) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => body.slice().buffer,
    })),
  )
}

describe("two-channel password mode", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("plain mode payload is standard base64 and still round-trips (backward compat)", async () => {
    const file = new File(
      [new TextEncoder().encode("plain data")],
      "p.txt",
      { type: "text/plain" },
    )
    const { data, payload } = await encryptFile(file)
    expect(payload.startsWith("p1.")).toBe(false)
    stubFetch(data)
    const out = await decryptAsset("arweave", "TX", payload)
    expect(new TextDecoder().decode(out.bytes)).toBe("plain data")
    expect(out.fileName).toBe("p.txt")
  })

  it("password roundtrip recovers bytes + metadata (slow: Argon2id)", async () => {
    const file = new File(
      [new TextEncoder().encode("secret bytes")],
      "s.txt",
      { type: "text/plain" },
    )
    const { data, payload } = await encryptFile(file, "hunter2")
    expect(payload.startsWith("p1.")).toBe(true)
    stubFetch(data)
    const out = await decryptAsset("arweave", "TX", payload, "hunter2")
    expect(new TextDecoder().decode(out.bytes)).toBe("secret bytes")
    expect(out.fileName).toBe("s.txt")
    expect(out.contentType).toBe("text/plain")
  }, 30000)

  it("wrong password throws (not MALFORMED) (slow: Argon2id)", async () => {
    const { data, payload } = await encryptFile(
      new File([new Uint8Array([1, 2, 3])], "f"),
      "right",
    )
    stubFetch(data)
    // Capture the rejection once (one Argon2id run) and assert it's a genuine
    // decrypt failure, distinct from the structural errors.
    const err = await decryptAsset("arweave", "TX", payload, "wrong").catch(
      (e) => e,
    )
    expect(err).toBeInstanceOf(Error)
    expect(String(err.message)).not.toContain("MALFORMED_LINK")
    expect(String(err.message)).not.toContain("PASSWORD_REQUIRED")
  }, 30000)

  it("MALFORMED_LINK for a p1 payload with the wrong part count", async () => {
    await expect(
      decryptAsset("arweave", "TX", "p1.onlytwo", "x"),
    ).rejects.toThrow("MALFORMED_LINK")
  })

  it("MALFORMED_LINK for a p1 payload with 3 parts but wrong R/salt length", async () => {
    // 3 dot-separated parts, but R decodes to <32 bytes → length guard trips
    // (must fire before the password check, even WITH a password supplied).
    await expect(
      decryptAsset("arweave", "TX", "p1.AAAA.BBBBBBBBBBBBBBBBBBBBBB", "anypw"),
    ).rejects.toThrow("MALFORMED_LINK")
  })

  it("PASSWORD_REQUIRED when a well-formed p1 payload has no password", async () => {
    // Build a well-formed p1 payload (R=32B, salt=16B) so it passes the length check and
    // reaches the password-presence check.
    const { payload } = await encryptFile(
      new File([new Uint8Array([9])], "g"),
      "pw",
    )
    expect(payload.startsWith("p1.")).toBe(true)
    await expect(decryptAsset("arweave", "TX", payload)).rejects.toThrow(
      "PASSWORD_REQUIRED",
    )
  }, 30000)
})
