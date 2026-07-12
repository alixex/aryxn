import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "happy-dom", // provides localStorage + WebCrypto for the store tests
    include: ["src/**/*.test.ts"],
    // Works around Node 22+'s experimental global localStorage/sessionStorage
    // shadowing happy-dom's implementation; see src/test/setup.ts.
    setupFiles: ["./src/test/setup.ts"],
  },
})
