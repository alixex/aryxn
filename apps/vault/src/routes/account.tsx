import { Suspense, lazy } from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { HydrateFallback } from "@/root"

const AccountPage = lazy(() => import("@/pages/Account"))

export default function Account() {
  return (
    <AppLayout>
      <Suspense fallback={<HydrateFallback />}>
        <AccountPage />
      </Suspense>
    </AppLayout>
  )
}
