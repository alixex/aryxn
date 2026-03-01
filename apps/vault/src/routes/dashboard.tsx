import { Suspense, lazy } from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { HydrateFallback } from "@/root"

const DashboardPage = lazy(() => import("@/pages/Dashboard"))

export default function Dashboard() {
  return (
    <AppLayout>
      <Suspense fallback={<HydrateFallback />}>
        <DashboardPage />
      </Suspense>
    </AppLayout>
  )
}
