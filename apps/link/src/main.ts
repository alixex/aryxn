import "ranui"
import "ranui/style"
import { initTheme, setTheme } from "ranui"
import { renderApp } from "./app"

// Restore persisted theme; default to following the OS (Geist light/dark).
initTheme()
setTheme("system")

const root = document.getElementById("app")
if (root) renderApp(root)
