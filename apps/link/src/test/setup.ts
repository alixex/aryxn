// Newer Node.js versions (22+) ship an experimental global `localStorage` /
// `sessionStorage` (see `node --help` -> --experimental-webstorage). Vitest's
// happy-dom environment only overrides globals that are NOT already present
// on `globalThis` (see `populateGlobal` in vitest/dist/chunks), so on these
// Node versions the native (non-functional without --localstorage-file)
// storage wins and shadows happy-dom's real implementation, breaking
// `localStorage.setItem` at runtime. Detect that case and swap in
// happy-dom's Storage implementation instead.
import { Window } from "happy-dom"

const isUsable = (key: "localStorage" | "sessionStorage") => {
  try {
    const store = (
      globalThis as unknown as Record<string, Storage | undefined>
    )[key]
    return typeof store?.setItem === "function"
  } catch {
    return false
  }
}

if (!isUsable("localStorage") || !isUsable("sessionStorage")) {
  const win = new Window()
  if (!isUsable("localStorage")) {
    Object.defineProperty(globalThis, "localStorage", {
      value: win.localStorage,
      configurable: true,
      writable: true,
    })
  }
  if (!isUsable("sessionStorage")) {
    Object.defineProperty(globalThis, "sessionStorage", {
      value: win.sessionStorage,
      configurable: true,
      writable: true,
    })
  }
}
