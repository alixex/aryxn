import path from "path"
import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import wasm from "vite-plugin-wasm"
import { RPCs } from "@aryxn/chain-constants"

export default defineConfig({
  base: "/aryxn/",
  plugins: [
    tailwindcss(),
    wasm(),
    // Node.js polyfills for Web3 libraries (Solana, Ethereum, etc.)
    nodePolyfills({
      globals: {
        Buffer: true,
        process: true,
        global: true,
      },
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@metamask/sdk": path.resolve(__dirname, "node_modules/@metamask/sdk"),
    },
  },
  optimizeDeps: {
    include: ["@metamask/sdk", "@rainbow-me/rainbowkit", "wagmi", "viem"],
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
  server: {
    proxy: {
      [RPCs.PROXY_EVM]: {
        target: RPCs.EVM_MAINNET_RPC,
        changeOrigin: true,
        rewrite: (path) => path.replace(new RegExp(`^${RPCs.PROXY_EVM}`), ""),
        configure: (proxy) => {
          proxy.on("error", (err) => {
            console.error("RPC proxy error:", err)
          })
        },
      },
      [RPCs.PROXY_SOLANA]: {
        target: RPCs.SOLANA_ANKR,
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(new RegExp(`^${RPCs.PROXY_SOLANA}`), ""),
        headers: {
          Origin: RPCs.SOLANA_ANKR_ORIGIN,
          Referer: RPCs.SOLANA_ANKR_ORIGIN,
        },
        configure: (proxy) => {
          proxy.on("error", (err) => {
            console.error("Solana RPC proxy error:", err)
          })
        },
      },
    },
  },
})
