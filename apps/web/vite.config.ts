import path from "path"
import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import wasm from "vite-plugin-wasm"
import tsconfigPaths from "vite-tsconfig-paths"

// Proxy paths previously from RPCs.PROXY_EVM / RPCs.PROXY_SOLANA
const PROXY_EVM = "/api/rpc"
const PROXY_SOLANA = "/api/solana-rpc"

export default defineConfig({
  base: "/aryxn/",
  plugins: [
    tailwindcss(),
    wasm(),
    tsconfigPaths(),
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
      [PROXY_EVM]: {
        target: "https://eth.llamarpc.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(new RegExp(`^${PROXY_EVM}`), ""),
        configure: (proxy) => {
          proxy.on("error", (err) => {
            console.error("RPC proxy error:", err)
          })
        },
      },
      [PROXY_SOLANA]: {
        target: "https://api.mainnet-beta.solana.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(new RegExp(`^${PROXY_SOLANA}`), ""),
        configure: (proxy) => {
          proxy.on("error", (err) => {
            console.error("Solana RPC proxy error:", err)
          })
        },
      },
    },
  },
})
