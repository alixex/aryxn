// Per-component ESM imports (tree-shakeable) — only the elements this app uses,
// plus the theme utils. The builder + reactivity come from "ranui/builder"
// (imported in app.ts). See memory [[ranui-import-system]].
import "ranui/theme-switch"
import "ranui/button"
import "ranui/progress"
import "ranui/link"
import "ranui/checkbox"
import "ranui/input"
import "ranui/modal"
import "ranui/message"
import "ranui/style"
import "ranui/fonts"
import { initTheme, setTheme } from "ranui/theme"
import { renderApp } from "./app"
import { type Chain } from "./storage"

// Restore persisted theme; default to following the OS (Geist light/dark).
initTheme()
setTheme("system")

const root = document.getElementById("app")
if (root) {
  // Encrypted-link viewer route: #/view/<chain>/<txId>/<key> — the key stays in
  // the fragment (client-side only). Lazily loaded so it's off the main path.
  const view = location.hash.match(/^#\/view\/(arweave|irys)\/([^/]+)\/(.+)$/)
  if (view) {
    const [, chain, txId, key] = view
    void import("./viewer").then(({ renderViewer }) =>
      renderViewer(root, chain as Chain, txId, key),
    )
  } else {
    // Built once inside a reactive scope — signals drive fine-grained updates.
    renderApp(root)
  }
}
