import { useState } from "react"
import { BridgeConfirmationDialog } from "./BridgeConfirmationDialog"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload } from "lucide-react"
import { useTranslation } from "@/i18n/config"
import { UploadButton } from "./UploadButton"
import { UploadProgress } from "./UploadProgress"
import { useUploadHandler } from "@/hooks/upload-hooks"
import type { UploadHandlerResult } from "@/hooks/upload-hooks"
import type {
  PaymentAccount,
  PaymentToken,
  UploadRedirectAction,
} from "@/lib/payment"
import { useNavigate } from "react-router-dom"

interface UploadExecutionCardProps {
  file: File | null
  files: File[]
  multipleMode: boolean
  encryptUpload: boolean
  compressUpload: boolean
  paymentToken: PaymentToken
  paymentAccount: PaymentAccount | null
  canUpload: boolean
  onUploadComplete?: () => void
}

export function UploadExecutionCard({
  file,
  files,
  multipleMode,
  encryptUpload,
  compressUpload,
  paymentToken,
  paymentAccount,
  canUpload,
  onUploadComplete,
}: UploadExecutionCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    uploading,
    paymentStage,
    progress,
    stage,
    handleUpload,
    handleBatchUpload,
  } = useUploadHandler()

  const [showBridgeDialog, setShowBridgeDialog] = useState(false)
  const [redirectAction, setRedirectAction] =
    useState<UploadRedirectAction>("bridge")

  const handleRedirectConfirm = () => {
    const query = new URLSearchParams({
      tab: redirectAction,
      source: "upload",
      token: paymentToken,
      chain: paymentAccount?.chain || "",
      action: redirectAction,
    })
    navigate(`/swap?${query.toString()}`)
    toast.info(
      redirectAction === "bridge"
        ? t("upload.bridgeRedirect", "Redirecting to swap bridge...")
        : t("upload.swapRedirect", "Redirecting to swap page..."),
    )
  }

  const handleUploadClick = async () => {
    let singleResult: UploadHandlerResult = {
      status: "FAILED",
      success: 0,
      failed: 1,
    }
    let batchResult: UploadHandlerResult = {
      status: "FAILED",
      success: 0,
      failed: 0,
    }

    if (multipleMode && files.length > 0) {
      batchResult = await handleBatchUpload(
        files,
        encryptUpload,
        compressUpload,
        paymentToken,
        paymentAccount,
      )

      if (
        batchResult.status === "BRIDGE_REQUIRED" ||
        batchResult.status === "SWAP_REQUIRED"
      ) {
        setRedirectAction(
          batchResult.status === "SWAP_REQUIRED" ? "swap" : "bridge",
        )
        setShowBridgeDialog(true)
        return
      }
    } else if (file) {
      singleResult = await handleUpload(
        file,
        encryptUpload,
        compressUpload,
        paymentToken,
        paymentAccount,
      )

      if (
        singleResult.status === "BRIDGE_REQUIRED" ||
        singleResult.status === "SWAP_REQUIRED"
      ) {
        setRedirectAction(
          singleResult.status === "SWAP_REQUIRED" ? "swap" : "bridge",
        )
        setShowBridgeDialog(true)
        return
      }
    }

    if (
      (singleResult.status === "SUCCESS" || batchResult.status === "SUCCESS") &&
      onUploadComplete
    ) {
      onUploadComplete()
    }
  }

  return (
    <>
      <BridgeConfirmationDialog
        open={showBridgeDialog}
        onOpenChange={setShowBridgeDialog}
        onConfirm={handleRedirectConfirm}
        token={paymentToken}
        action={redirectAction}
      />
      <Card className="glass-premium hover:shadow-primary/5 border-none shadow-2xl transition-all duration-500">
        <CardHeader className="glass-strong animate-fade-in-down border-accent/30 bg-card/60 rounded-t-2xl border-b-2 p-6 shadow-lg">
          <CardTitle className="text-foreground flex items-center gap-3 text-lg font-bold sm:text-xl">
            <div className="rounded-lg bg-cyan-400/20 p-2">
              <Upload className="h-5 w-5 text-cyan-400" />
            </div>
            {t("upload.execute")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <UploadButton
            uploading={uploading}
            file={file}
            canUpload={canUpload}
            encryptUpload={encryptUpload}
            onClick={handleUploadClick}
          />
          {(uploading || paymentStage) && (
            <UploadProgress
              progress={{
                stage: paymentStage ? t("upload.processingPayment") : stage,
                progress: progress,
              }}
            />
          )}
        </CardContent>
      </Card>
    </>
  )
}
