import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload } from "lucide-react"
import { useTranslation } from "@/i18n/config"
import { UploadButton } from "./UploadButton"
import { UploadProgress } from "./UploadProgress"
import { useUploadHandler } from "@/hooks/upload-hooks"
import type { PaymentToken } from "@/lib/payment-service"

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
    <Card className="border-border overflow-hidden rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl">
      <CardHeader className="border-border border-b pb-4 sm:pb-6">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <div className="bg-secondary flex h-8 w-8 items-center justify-center rounded-lg">
            <Upload className="text-foreground h-4 w-4" />
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
