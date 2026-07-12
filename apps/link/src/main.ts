// Per-component ESM imports (tree-shakeable) — only the elements this app uses,
// plus the theme utils. The builder + reactivity come from "ranui/builder"
// (imported in pages/home.ts, pages/accounts.ts, shell.ts). See memory
// [[ranui-import-system]].
import "ranui/theme-switch"
import "ranui/button"
import "ranui/progress"
import "ranui/loading"
import "ranui/checkbox"
import "ranui/input"
import "ranui/message"
import "ranui/style"
import "ranui/fonts"
import { initTheme, setTheme } from "ranui/theme"
import { migrateLegacy } from "./accounts"
import { mountShell } from "./shell"

// Restore persisted theme; default to following the OS (Geist light/dark).
initTheme()
setTheme("system")

// One-time reshape of the legacy single-slot account into the multi-account
// book (see accounts.ts). No-op once already migrated.
migrateLegacy()

const root = document.getElementById("app")
if (root) mountShell(root)
