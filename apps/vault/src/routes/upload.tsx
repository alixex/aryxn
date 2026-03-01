import { Suspense, lazy } from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { HydrateFallback } from "@/root"

const UploadPage = lazy(() => import("@/pages/Upload"))

export default function Upload() {
  return (
    <AppLayout>
      <Suspense fallback={<HydrateFallback />}>
        <UploadPage />
      </Suspense>
    </AppLayout>
  )
}
