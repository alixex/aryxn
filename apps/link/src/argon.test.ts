import { describe, it, expect } from "vitest"
import { combineKeyHalves, toBase64Url, fromBase64Url, deriveArgon2idKey } from "@alixex/crypto"

describe("base64url", () => {
  it("round-trips arbitrary bytes without padding chars", () => {
    const b = new Uint8Array([251, 239, 190, 0, 1, 2, 3])
    const s = toBase64Url(b)
    expect(s).not.toMatch(/[+/=]/)
    expect([...fromBase64Url(s)]).toEqual([...b])
  })
})

describe("combineKeyHalves", () => {
  it("is deterministic and order-sensitive", async () => {
    const r = new Uint8Array(32).fill(1)
    const p = new Uint8Array(32).fill(2)
    const k1 = await combineKeyHalves(r, p)
    const k2 = await combineKeyHalves(r, p)
    expect(k1.length).toBe(32)
    expect([...k1]).toEqual([...k2])
    const swapped = await combineKeyHalves(p, r)
    expect([...swapped]).not.toEqual([...k1])
  })
})

describe("deriveArgon2idKey (slow: exercises Argon2id MODERATE ~256MiB)", () => {
  it("same password+salt → same 32-byte key, NFC-normalized", async () => {
    const salt = new Uint8Array(16).fill(7)
    const a = await deriveArgon2idKey("café", salt)       // precomposed é
    const b = await deriveArgon2idKey("café", salt)      // e + combining acute (NFC → same)
    expect(a.length).toBe(32)
    expect([...a]).toEqual([...b])
  }, 30000)
})
