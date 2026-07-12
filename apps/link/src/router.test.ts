import { describe, it, expect } from "vitest"
import { stripBase, parseViewerHash } from "./router"

describe("stripBase", () => {
  it("returns the path unchanged under root base", () => {
    expect(stripBase("/accounts", "/")).toBe("/accounts")
    expect(stripBase("/", "/")).toBe("/")
  })
  it("strips a non-root base prefix", () => {
    expect(stripBase("/app/accounts", "/app/")).toBe("/accounts")
    expect(stripBase("/app/", "/app/")).toBe("/")
  })
})

describe("parseViewerHash", () => {
  it("parses a plain viewer hash", () => {
    expect(parseViewerHash("#/view/arweave/TX123/KEYB64")).toEqual({
      chain: "arweave", txId: "TX123", payload: "KEYB64",
    })
  })
  it("captures a password-mode payload containing dots", () => {
    expect(parseViewerHash("#/view/irys/TX9/p1.RRR.SSS")).toEqual({
      chain: "irys", txId: "TX9", payload: "p1.RRR.SSS",
    })
  })
  it("returns null for non-viewer hashes", () => {
    expect(parseViewerHash("")).toBeNull()
    expect(parseViewerHash("#/accounts")).toBeNull()
  })
})
