import { Suspense, lazy } from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { HydrateFallback } from "@/root"

const SettingsPage = lazy(() => import("@/pages/Settings"))

export default function Settings() {
  return (
    <AppLayout>
      <Suspense fallback={<HydrateFallback />}>
        <SettingsPage />
      </Suspense>
    </AppLayout>
  )
}
