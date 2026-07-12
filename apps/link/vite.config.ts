import path from "path"
import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import wasm from "vite-plugin-wasm"

// "/" for custom domain (aryxn.com); "/repo/" for project pages.
const rawBasePath = (process.env.VITE_BASE_PATH || "/").trim()
const base =
  rawBasePath === "/" ? "/" : `/${rawBasePath.replace(/^\/+|\/+$/g, "")}/`

export default defineConfig({
  base,
  plugins: [
    wasm(),
    // Arweave / crypto libs expect Node globals (Buffer, process) in the browser.
    nodePolyfills({
      globals: { Buffer: true, process: true, global: true },
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
})
