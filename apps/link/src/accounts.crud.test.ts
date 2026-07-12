import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@alixex/crypto", () => ({
  encryptStringForStorage: vi.fn(async (plain: string, pw: string) => ({
    pw,
    plain,
  })),
  decryptStringFromStorage: vi.fn(
    async (enc: { pw: string; plain: string }, pw: string) => {
      if (enc.pw !== pw) throw new Error("bad pw")
      return enc.plain
    },
  ),
}))
vi.mock("@alixex/arweave", () => ({
  arweave: {
    wallets: {
      jwkToAddress: vi.fn(async (jwk: { n: string }) => `addr_${jwk.n}`),
    },
  },
  generateArweaveWallet: vi.fn(async () => ({ key: { kty: "RSA", n: "NEW" } })),
}))
vi.mock("./wallet", () => ({
  connectArweave: vi.fn(async () => "WANDER_ADDR"),
}))

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
    await expect(
      importLocal(JSON.stringify({ kty: "EC" }), "MASTER"),
    ).rejects.toThrow()
  })

  it("removeAccount re-derives the active pointer", async () => {
    const { addLocal, connectEvm, setActive, removeAccount, activeId } =
      await fresh()
    const first = await addLocal("MASTER")
    const second = connectEvm("0xDEF")
    await setActive(second.id)
    expect(activeId()).toBe(second.id)
    removeAccount(second.id)
    expect(activeId()).toBe(first.id)
  })

  it("setActive throws VAULT_LOCKED for a local account when the session is locked", async () => {
    const { addLocal } = await fresh()
    const rec = await addLocal("MASTER") // creates + persists a local account
    // Fresh session: masterPw resets to null, but the account + vault persist on disk.
    vi.resetModules()
    const { setActive } = await fresh()
    await expect(setActive(rec.id)).rejects.toThrow("VAULT_LOCKED")
  })

  it("importLocal with a bad JWK does not establish a phantom master", async () => {
    const { importLocal, addLocal } = await fresh()
    await expect(
      importLocal(JSON.stringify({ kty: "EC" }), "MASTER"),
    ).rejects.toThrow()
    // The failed import must not have set masterPw; addLocal() with no password rejects.
    await expect(addLocal()).rejects.toThrow("VAULT_LOCKED")
  })
})

describe("export", () => {
  it("exportKeyfile returns the jwk JSON for a created (unlocked) local account", async () => {
    const { addLocal, exportKeyfile } = await fresh()
    const rec = await addLocal("MASTER")
    const json = exportKeyfile(rec.id)
    expect(json).not.toBeNull()
    expect(JSON.parse(json!)).toEqual({ kty: "RSA", n: "NEW" }) // matches the mocked generateArweaveWallet
  })

  it("exportKeyfile returns null for an unknown id", async () => {
    const { exportKeyfile } = await fresh()
    expect(exportKeyfile("nope")).toBeNull()
  })

  it("exportEncrypted returns a blob (and null when the account isn't loaded)", async () => {
    const { addLocal, exportEncrypted } = await fresh()
    const rec = await addLocal("MASTER")
    const blob = await exportEncrypted(rec.id, "backuppw")
    expect(blob).not.toBeNull()
    // With the mocked crypto, encryptStringForStorage returns {pw, plain}; the blob is its JSON.
    expect(JSON.parse(blob!)).toMatchObject({ pw: "backuppw" })
    expect(await exportEncrypted("nope", "x")).toBeNull()
  })
})
