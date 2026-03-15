import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router"
import { useEffect, useState } from "react"
import { Providers } from "./providers"
import "./index.css"
import "./i18n/config"

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <link rel="icon" type="image/x-icon" href="/aryxn/favicon.ico" />
        <Meta />
        <Links />
      </head>
      <body>
        <Providers>{children}</Providers>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

/**
 * HydrateFallback component for React Router
 * This component is rendered during client-side loading when loading JS modules
 * or running clientLoader functions.
 */
export function HydrateFallback(_props?: {
  params?: Record<string, string>
  loaderData?: unknown
  actionData?: unknown
}) {
  // Ensure this renders the same on both server and client
  // No browser-specific APIs, no dynamic content, no conditional rendering
  // Props are accepted but not used to match React Router's expected signature
  return (
    <div className="bg-background bg-gradient-radial flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="border-border/30 border-t-primary glow-purple h-16 w-16 animate-spin rounded-full border-4"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-gradient-primary h-8 w-8 rounded-full shadow-lg"></div>
          </div>
        </div>
        <div className="text-center">
          <p className="text-foreground text-sm font-semibold">Loading...</p>
          <p className="text-muted-foreground mt-2 text-xs">
            Preparing your vault
          </p>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const initialize = async () => {
      // Initialize SQLite database only on the client.
      if (typeof window !== "undefined") {
        const { initializeDatabase } = await import("./lib/database/sqlite-db")
        await initializeDatabase()
      }
      setMounted(true)
    }

    initialize()
  }, [])

  // Show loading until database initialization is done instead of returning null.
  // This avoids flicker (HTML loading -> clear -> React loading).
  if (!mounted) {
    return (
      <div className="bg-background bg-gradient-radial flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="border-border/30 border-t-primary glow-purple h-16 w-16 animate-spin rounded-full border-4"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-gradient-primary h-8 w-8 rounded-full shadow-lg"></div>
            </div>
          </div>
          <div className="text-center">
            <p className="text-foreground text-sm font-semibold">Loading...</p>
            <p className="text-muted-foreground mt-2 text-xs">
              Preparing your vault
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <Outlet />
}
