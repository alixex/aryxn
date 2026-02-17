import { useState, useMemo } from "react"
import { useTranslation } from "@/i18n/config"
import { UploadWarning } from "@/components/upload/UploadWarning"
import { FileSelectionCard } from "@/components/upload/FileSelectionCard"
import type { FileSelection } from "@/components/upload/FileSelectionCard"
import { UploadConfigurationCard } from "@/components/upload/UploadConfigurationCard"
import type { UploadConfiguration } from "@/components/upload/UploadConfigurationCard"
import { AccountSelector } from "@/components/upload/AccountSelector"
import { UploadExecutionCard } from "@/components/upload/UploadExecutionCard"
import { useWallet } from "@/hooks/account-hooks"
import { ArweaveFeeInfo } from "@/components/upload/ArweaveFeeInfo"
import { SecurityNotice } from "@/components/upload/SecurityNotice"
import { Steps } from "@/components/ui/steps"
import { FilePreview } from "@/components/ui/file-preview"

export default function UploadPage() {
  const { t } = useTranslation()
  const wallet = useWallet()
  const activeAccount = wallet.active

  // For upload, we specifically need Arweave account
  const ownerAddress = activeAccount.arweave?.address
  const hasArweaveAccount = Boolean(activeAccount.arweave)
  const isExternalArweave = activeAccount.arweave?.isExternal ?? false

  // Minimal state - only coordination between cards
  const [selectedFiles, setSelectedFiles] = useState<FileSelection>({
    file: null,
    files: [],
    multipleMode: false,
  })

  const [uploadConfig, setUploadConfig] = useState<UploadConfiguration>({
    encryptUpload: false,
    compressUpload: false,
    paymentToken: "AR",
  })

  // Check if user can upload
  const canUpload = Boolean(
    (selectedFiles.file || selectedFiles.files.length > 0) && hasArweaveAccount,
  )
  const isDisabled = !hasArweaveAccount

  // Calculate current step
  const currentStep = useMemo(() => {
    if (!selectedFiles.file && selectedFiles.files.length === 0) return 0
    if (!uploadConfig.encryptUpload && !uploadConfig.compressUpload) return 1
    if (!canUpload) return 2
    return 3
  }, [selectedFiles, uploadConfig, canUpload])

  // Define upload steps
  const uploadSteps = [
    { title: t("upload.step1", "选择文件") },
    { title: t("upload.step2", "配置选项") },
    { title: t("upload.step3", "确认账户") },
    { title: t("upload.step4", "开始上传") },
  ]

  // Reset file selection after successful upload
  const handleUploadComplete = () => {
    setSelectedFiles({ file: null, files: [], multipleMode: false })
  }

  return (
    <div className="mesh-gradient relative min-h-screen">
      <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto max-w-6xl space-y-6 px-3 py-6 duration-1000 sm:space-y-8 sm:px-4 sm:py-8">
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-3 text-3xl font-extrabold tracking-tighter sm:text-4xl lg:text-5xl">
            <div className="bg-gradient-primary glow-purple rounded-xl p-2 text-white shadow-xl ring-1 ring-white/20 sm:rounded-2xl sm:p-2.5">
              <svg
                className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <span className="bg-gradient-primary gradient-text leading-tight">
              {t("common.upload")}
            </span>
          </h2>
          <p className="text-subtitle-muted max-w-lg text-base leading-relaxed font-medium">
            {t("upload.arweaveDesc")}
          </p>
        </div>

        <div className="grid gap-6">
          <UploadWarning
            isLocked={!hasArweaveAccount}
            hasExternalWallet={isExternalArweave}
          />

          {/* Upload Steps Indicator */}
          {hasArweaveAccount && (
            <Steps steps={uploadSteps} currentStep={currentStep} />
          )}

          <FileSelectionCard
            disabled={isDisabled}
            onChange={setSelectedFiles}
          />

          {/* File Preview */}
          {selectedFiles.file && <FilePreview file={selectedFiles.file} />}

          <UploadConfigurationCard
            file={selectedFiles.file}
            files={selectedFiles.files}
            isUnlocked={hasArweaveAccount}
            ownerAddress={ownerAddress}
            onChange={setUploadConfig}
          />

          <AccountSelector file={selectedFiles.file} />

          {hasArweaveAccount && (
            <UploadExecutionCard
              file={selectedFiles.file}
              files={selectedFiles.files}
              multipleMode={selectedFiles.multipleMode}
              encryptUpload={uploadConfig.encryptUpload}
              compressUpload={uploadConfig.compressUpload}
              paymentToken={uploadConfig.paymentToken}
              canUpload={canUpload}
              onUploadComplete={handleUploadComplete}
            />
          )}

          <ArweaveFeeInfo />

          <SecurityNotice />
        </div>
      </div>
    </div>
  )
}
