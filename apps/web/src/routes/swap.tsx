import { Suspense, lazy } from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { HydrateFallback } from "@/root"

const SwapPage = lazy(() => import("@/pages/Swap"))

export default function Swap() {
  return (
    <AppLayout>
      <Suspense fallback={<HydrateFallback />}>
        <SwapPage />
      </Suspense>
    </AppLayout>
  )
}
