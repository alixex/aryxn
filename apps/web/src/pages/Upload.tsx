import { useState } from "react"
import { useTranslation } from "@/i18n/config"
import { UploadWarning } from "@/components/upload/UploadWarning"
import { FileSelectionCard } from "@/components/upload/FileSelectionCard"
import type { FileSelection } from "@/components/upload/FileSelectionCard"
import { UploadConfigurationCard } from "@/components/upload/UploadConfigurationCard"
import type { UploadConfiguration } from "@/components/upload/UploadConfigurationCard"
import { AccountSelector } from "@/components/upload/AccountSelector"
import { UploadExecutionCard } from "@/components/upload/UploadExecutionCard"
import { useWallet } from "@/hooks/use-wallet"
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
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("common.upload")}
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
