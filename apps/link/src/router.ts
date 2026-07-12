import { createRoot } from "ranui/builder"

export type PageRender = (host: HTMLElement, params: Record<string, string>) => void

interface Route {
  path: string // exact path, base-stripped, e.g. "/" or "/accounts"
  render: PageRender
}

const BASE = import.meta.env.BASE_URL || "/"

/** Strip the deploy base prefix from a pathname → an app path beginning with "/". */
export function stripBase(pathname: string, base: string = BASE): string {
  const b = base.endsWith("/") ? base.slice(0, -1) : base // "/foo/" -> "/foo", "/" -> ""
  const p = b && pathname.startsWith(b) ? pathname.slice(b.length) : pathname
  return p.startsWith("/") ? p : "/" + p
}

/** Parse a viewer hash `#/view/<chain>/<txId>/<payload>` → params, or null. */
export function parseViewerHash(hash: string): Record<string, string> | null {
  const m = hash.match(/^#\/view\/(arweave|irys)\/([^/]+)\/(.+)$/)
  return m ? { chain: m[1], txId: m[2], payload: m[3] } : null
}

/**
 * Mount the router into `outlet`. `viewer` renders when a `#/view/...` hash is
 * present (takes precedence); otherwise the matching `routes` entry renders, or
 * `notFound`. Returns a teardown that removes listeners and disposes the page.
 */
export function mountRouter(
  outlet: HTMLElement,
  routes: Route[],
  viewer: PageRender,
  notFound: PageRender,
): () => void {
  let dispose: (() => void) | null = null

  const run = (): void => {
    dispose?.()
    const v = parseViewerHash(location.hash)
    if (v) {
      dispose = createRoot((d) => {
        viewer(outlet, v)
        return d
      })
      return
    }
    const path = stripBase(location.pathname)
    const route = routes.find((r) => r.path === path)
    const render = route?.render ?? notFound
    dispose = createRoot((d) => {
      render(outlet, {})
      return d
    })
  }

  window.addEventListener("popstate", run)
  window.addEventListener("hashchange", run)
  run()

  return () => {
    window.removeEventListener("popstate", run)
    window.removeEventListener("hashchange", run)
    dispose?.()
  }
}

/** Navigate to an app path (history mode). Clears any viewer hash. */
export function navigate(path: string): void {
  const b = BASE.endsWith("/") ? BASE.slice(0, -1) : BASE
  history.pushState(null, "", (b + path) || "/")
  window.dispatchEvent(new PopStateEvent("popstate"))
}
