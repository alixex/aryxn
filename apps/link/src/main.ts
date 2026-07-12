// Per-component ESM imports (tree-shakeable) — only the elements this app uses,
// plus the theme utils. The builder + reactivity come from "ranui/builder"
// (imported in app.ts). See memory [[ranui-import-system]].
import "ranui/theme-switch"
import "ranui/button"
import "ranui/progress"
import "ranui/link"
import "ranui/style"
import { initTheme, setTheme } from "ranui/theme"
import { renderApp } from "./app"

// Restore persisted theme; default to following the OS (Geist light/dark).
initTheme()
setTheme("system")

// Built once inside a reactive scope — signals drive fine-grained updates, so
// there is no full re-render (language switch, balance, links update in place).
const root = document.getElementById("app")
if (root) renderApp(root)
