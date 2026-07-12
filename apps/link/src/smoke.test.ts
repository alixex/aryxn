import { describe, it, expect } from "vitest"

describe("harness", () => {
  it("has localStorage", () => {
    localStorage.setItem("k", "v")
    expect(localStorage.getItem("k")).toBe("v")
  })
})
