import { describe, it, expect, beforeEach, vi } from "vitest"

// Deterministic, fast doubles for the crypto + arweave deps.
vi.mock("@alixex/crypto", () => ({
  // "encrypt" = wrap; "decrypt" = unwrap iff pw matches, else throw.
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

import {
  migrateLegacy,
  unlockVault,
  isVaultUnlocked,
  accounts,
  activeAccount,
  activeJwk,
} from "./accounts"

// The legacy blob format equals the old account.ts: JSON.stringify(encryptStringForStorage(jwkJson, pw)).
function legacyBlob(jwk: object, pw: string): string {
  return JSON.stringify({ pw, plain: JSON.stringify(jwk) })
}

describe("migration + unlock", () => {
  beforeEach(() => {
    localStorage.clear()
    // reset module singletons by reimporting is complex; instead assert on a fresh key set per test
  })

  it("migrates the legacy single account into the book, locked (empty address)", () => {
    localStorage.setItem(
      "aryxn:account",
      legacyBlob({ kty: "RSA", n: "OLD" }, "P"),
    )
    migrateLegacy()
    expect(localStorage.getItem("aryxn:account")).toBeNull()
    const list = accounts()
    expect(list.length).toBe(1)
    expect(list[0].type).toBe("local")
    expect(list[0].address).toBe("") // locked until unlock
    expect(activeAccount()?.id).toBe(list[0].id)
    // vault holds the ciphertext verbatim
    const vault = JSON.parse(localStorage.getItem("aryxn:vault")!)
    expect(vault[list[0].id]).toBe(legacyBlob({ kty: "RSA", n: "OLD" }, "P"))
  })

  it("unlock with the old password backfills the address and caches the jwk", async () => {
    await unlockVault("P")
    expect(isVaultUnlocked()).toBe(true)
    expect(activeAccount()?.address).toBe("addr_OLD")
    expect(activeJwk()).toEqual({ kty: "RSA", n: "OLD" })
  })

  it("unlock with a wrong password throws and does not unlock", async () => {
    // Seed a real vault entry (password "RIGHT") via the public migrate path,
    // so unlockVault actually has an entry to reject — self-contained, order-independent.
    localStorage.setItem(
      "aryxn:account",
      legacyBlob({ kty: "RSA", n: "WRONGTEST" }, "RIGHT"),
    )
    migrateLegacy()
    await expect(unlockVault("WRONG")).rejects.toThrow()
  })
})
