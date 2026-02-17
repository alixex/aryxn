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

  const handleUploadClick = async () => {
    let success = false

    if (multipleMode && files.length > 0) {
      // Batch upload
      const result = await handleBatchUpload(
        files,
        encryptUpload,
        compressUpload,
        paymentToken,
      )
      success = result.success > 0
    } else if (file) {
      // Single file upload
      success = await handleUpload(
        file,
        encryptUpload,
        compressUpload,
        paymentToken,
      )
    }

    if (success && onUploadComplete) {
      onUploadComplete()
    }
  }

  return (
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
  )
}
