import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings } from "lucide-react"
import { useTranslation } from "@/i18n/config"
import { UploadOptions } from "./UploadOptions"
import { FeeEstimate } from "./FeeEstimate"
import { useFeeCalculation } from "@/hooks/dex-hooks"
import { shouldCompressFile } from "@/lib/utils"

import type { PaymentToken } from "@/lib/payment"
import { PaymentTokenSelector } from "./PaymentTokenSelector"

export interface UploadConfiguration {
  encryptUpload: boolean
  compressUpload: boolean
  paymentToken: PaymentToken
}

interface UploadConfigurationCardProps {
  file: File | null
  files: File[]
  isUnlocked: boolean
  ownerAddress?: string
  onChange: (config: UploadConfiguration) => void
}

export function UploadConfigurationCard({
  file,
  files,
  isUnlocked,
  ownerAddress,
  onChange,
}: UploadConfigurationCardProps) {
  const { t } = useTranslation()
  const [encryptUpload, setEncryptUpload] = useState(false)
  const [compressUpload, setCompressUpload] = useState(false)
  const [paymentToken, setPaymentToken] = useState<PaymentToken>("AR")

  const {
    estimatedFee,
    calculatingFee,
    feeError,
    calculateFee,
    calculateBatchFee,
  } = useFeeCalculation()

  // Set compression based on file type when file changes
  useEffect(() => {
    if (file) {
      const shouldCompress = shouldCompressFile(file.size, file.name, file.type)
      setCompressUpload(shouldCompress)
    } else if (files.length > 0) {
      const shouldCompress = shouldCompressFile(
        files[0].size,
        files[0].name,
        files[0].type,
      )
      setCompressUpload(shouldCompress)
    }
  }, [file, files])

  // Recalculate fee when file or options change
  useEffect(() => {
    const multipleMode = files.length > 0
    if (multipleMode) {
      calculateBatchFee(files, encryptUpload, compressUpload, ownerAddress)
    } else if (file) {
      calculateFee(file, encryptUpload, compressUpload, ownerAddress)
    }
  }, [
    file,
    files,
    encryptUpload,
    compressUpload,
    ownerAddress,
    calculateFee,
    calculateBatchFee,
  ])

  // Notify parent when configuration changes
  useEffect(() => {
    onChange({ encryptUpload, compressUpload, paymentToken })
  }, [encryptUpload, compressUpload, paymentToken, onChange])

  const handleEncryptChange = (checked: boolean) => {
    setEncryptUpload(checked)
  }

  const handleCompressChange = (checked: boolean) => {
    setCompressUpload(checked)
  }

  return (
    <Card className="glass-premium hover:shadow-primary/5 border-none shadow-2xl transition-all duration-500">
      <CardHeader className="border-border border-b pb-4 sm:pb-6">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <div className="bg-secondary flex h-8 w-8 items-center justify-center rounded-lg">
            <Settings className="text-foreground h-4 w-4" />
          </div>
          {t("upload.configuration")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <UploadOptions
          encryptUpload={encryptUpload}
          compressUpload={compressUpload}
          file={file}
          files={files}
          isUnlocked={isUnlocked}
          onEncryptChange={handleEncryptChange}
          onCompressChange={handleCompressChange}
        />

        <PaymentTokenSelector
          selectedToken={paymentToken}
          onSelectToken={setPaymentToken}
        />

        <FeeEstimate
          file={file}
          files={files}
          estimatedFee={estimatedFee}
          calculatingFee={calculatingFee}
          feeError={feeError}
          encryptUpload={encryptUpload}
          compressUpload={compressUpload}
          shouldCompressFile={shouldCompressFile}
          selectedToken={paymentToken}
        />
      </CardContent>
    </Card>
  )
}
