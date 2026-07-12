import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@alixex/crypto", () => ({
  encryptStringForStorage: vi.fn(async (plain: string, pw: string) => ({ pw, plain })),
  decryptStringFromStorage: vi.fn(async (enc: { pw: string; plain: string }, pw: string) => {
    if (enc.pw !== pw) throw new Error("bad pw")
    return enc.plain
  }),
}))
vi.mock("@alixex/arweave", () => ({
  arweave: { wallets: { jwkToAddress: vi.fn(async (jwk: { n: string }) => `addr_${jwk.n}`) } },
  generateArweaveWallet: vi.fn(async () => ({ key: { kty: "RSA", n: "NEW" } })),
}))
vi.mock("./wallet", () => ({ connectArweave: vi.fn(async () => "WANDER_ADDR") }))

beforeEach(() => {
  localStorage.clear()
  vi.resetModules() // fresh accounts module (fresh signals + masterPw + vaultCache) per test
})

const fresh = () => import("./accounts")

describe("crud", () => {
  it("addLocal establishes the master password on the first account", async () => {
    const { addLocal, accounts } = await fresh()
    const rec = await addLocal("MASTER")
    expect(rec.type).toBe("local")
    expect(rec.address).toBe("addr_NEW")
    expect(accounts().some((a) => a.id === rec.id)).toBe(true)
  })

  it("addLocal without a password throws VAULT_LOCKED when no master is set and vault is non-empty", async () => {
    const { addLocal } = await fresh()
    await addLocal("MASTER") // establishes master + one entry
    // Simulate a fresh session where master isn't in memory: re-import to reset masterPw but keep vault on disk.
    vi.resetModules()
    const { addLocal: addLocal2 } = await fresh()
    await expect(addLocal2()).rejects.toThrow("VAULT_LOCKED")
  })

  it("connectEvm dedupes by address (case-insensitive)", async () => {
    const { connectEvm } = await fresh()
    const a = connectEvm("0xABC")
    const b = connectEvm("0xabc")
    expect(a.id).toBe(b.id)
    expect(a.network).toBe("evm")
  })

  it("importLocal rejects a non-Arweave JWK", async () => {
    const { importLocal } = await fresh()
    await expect(importLocal(JSON.stringify({ kty: "EC" }), "MASTER")).rejects.toThrow()
  })

  it("removeAccount re-derives the active pointer", async () => {
    const { addLocal, connectEvm, setActive, removeAccount, activeId } = await fresh()
    const first = await addLocal("MASTER")
    const second = connectEvm("0xDEF")
    await setActive(second.id)
    expect(activeId()).toBe(second.id)
    removeAccount(second.id)
    expect(activeId()).toBe(first.id)
  })
})
