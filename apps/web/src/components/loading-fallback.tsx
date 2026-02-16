/**
 * HydrateFallback component for React Router
 * This component is rendered during client-side loading when loading JS modules
 * or running clientLoader functions.
 */
export function HydrateFallback() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="border-border border-t-primary h-16 w-16 animate-spin rounded-full border-4"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-gradient-primary h-8 w-8 rounded-full"></div>
          </div>
        </div>
        <div className="text-center">
          <p className="text-foreground text-sm font-medium">Loading...</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Preparing your vault
          </p>
        </div>
      </div>
    </div>
  )
}
