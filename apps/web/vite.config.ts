import path from "path"
import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import wasm from "vite-plugin-wasm"

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
      "/api/rpc": {
        target: "https://eth.llamarpc.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/rpc/, ""),
        configure: (proxy) => {
          proxy.on("error", (err) => {
            console.error("RPC proxy error:", err)
          })
        },
      },
      "/api/solana-rpc": {
        target: "https://rpc.ankr.com/solana",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/solana-rpc/, ""),
        headers: {
          Origin: "https://rpc.ankr.com",
          Referer: "https://rpc.ankr.com",
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
