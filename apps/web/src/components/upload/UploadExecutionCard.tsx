import { useState } from "react"
import { BridgeConfirmationDialog } from "./BridgeConfirmationDialog"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload } from "lucide-react"
import { useTranslation } from "@/i18n/config"
import { UploadButton } from "./UploadButton"
import { UploadProgress } from "./UploadProgress"
import { useUploadHandler } from "@/hooks/upload-hooks"
import type { PaymentToken } from "@/lib/payment"

interface UploadExecutionCardProps {
  file: File | null
  files: File[]
  multipleMode: boolean
  encryptUpload: boolean
  compressUpload: boolean
  paymentToken: PaymentToken
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
  canUpload,
  onUploadComplete,
}: UploadExecutionCardProps) {
  const { t } = useTranslation()
  const {
    uploading,
    paymentStage,
    progress,
    stage,
    handleUpload,
    handleBatchUpload,
  } = useUploadHandler()

  const [showBridgeDialog, setShowBridgeDialog] = useState(false)

  const handleBridgeConfirm = () => {
    // Navigate to bridge page or trigger bridge flow
    // For now, simpler simulation
    window.open("https://portalbridge.com/", "_blank")
    toast.info(t("upload.bridgeRedirect", "Redirecting to bridge provider..."))
  }

  const handleUploadClick = async () => {
    let result = false
    let batchResult = { success: 0, failed: 0 }

    if (multipleMode && files.length > 0) {
      batchResult = await handleBatchUpload(
        files,
        encryptUpload,
        compressUpload,
        paymentToken,
      )

      // Check if bridge required
      // @ts-ignore - status property added dynamically
      if (batchResult.status === "BRIDGE_REQUIRED") {
        setShowBridgeDialog(true)
        return
      }
    } else if (file) {
      // Single file upload
      const response = await handleUpload(
        file,
        encryptUpload,
        compressUpload,
        paymentToken,
      )

      if ((response as unknown as string) === "BRIDGE_REQUIRED") {
        setShowBridgeDialog(true)
        return
      }

      result = response === true
    }

    if ((result || batchResult.success > 0) && onUploadComplete) {
      onUploadComplete()
    }
  }

  return (
    <>
      <BridgeConfirmationDialog
        open={showBridgeDialog}
        onOpenChange={setShowBridgeDialog}
        onConfirm={handleBridgeConfirm}
        token={paymentToken}
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
