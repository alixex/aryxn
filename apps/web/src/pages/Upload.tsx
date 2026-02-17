import { useState } from "react"
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

  // Reset file selection after successful upload
  const handleUploadComplete = () => {
    setSelectedFiles({ file: null, files: [], multipleMode: false })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-4 sm:space-y-8 sm:py-8">
      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-3xl font-bold tracking-tight sm:text-4xl">
          <div className="bg-gradient-primary shrink-0 rounded p-1.5 text-white">
            <svg
              className="h-5 w-5 sm:h-6 sm:w-6"
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
          <span className="bg-gradient-primary gradient-text inline-block align-middle leading-tight">
            {t("common.upload")}
          </span>
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          {t("upload.arweaveDesc")}
        </p>
      </div>

      <UploadWarning
        isLocked={!hasArweaveAccount}
        hasExternalWallet={isExternalArweave}
      />

      <FileSelectionCard disabled={isDisabled} onChange={setSelectedFiles} />

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
  )
}
