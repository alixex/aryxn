import { useState, useEffect } from "react"
import { useTranslation } from "@/i18n/config"
import { UploadWarning } from "@/components/upload/UploadWarning"
import { FileUploadSection } from "@/components/upload/FileUploadSection"
import { UploadOptions } from "@/components/upload/UploadOptions"
import { PaymentTokenSelector } from "@/components/upload/PaymentTokenSelector"
import { UploadButton } from "@/components/upload/UploadButton"
import { UploadProgress } from "@/components/upload/UploadProgress"
import { useWallet } from "@/hooks/account-hooks"
import { useUploadHandler } from "@/hooks/upload-hooks"
import { Chains } from "@aryxn/chain-constants"
import { getIrysFundingToken } from "@/lib/payment/upload-payment-config"
import { ChainIcon } from "@/components/common/ChainIcon"
import type { PaymentAccount, PaymentToken } from "@/lib/payment"
import { FilePreview } from "@/components/ui/file-preview"
import { Card, CardContent } from "@/components/ui/card"
import { Info, X } from "lucide-react"
import { shouldCompressFile } from "@/lib/utils"
import { PageHeader } from "@/components/layout/PageHeader"

export default function UploadPage() {
  const { t } = useTranslation()
  const wallet = useWallet()
  const walletManager = wallet.internal
  const {
    uploading,
    paymentStage,
    progress,
    stage,
    recoveryMessage,
    recoveryState,
    clearRecovery,
    handleUpload,
    handleBatchUpload,
  } = useUploadHandler()

  // For upload, we specifically check for Arweave account existence
  const activeArweave = walletManager.wallets.find(
    (w) =>
      w.address === walletManager.activeAddress && w.chain === Chains.ARWEAVE,
  )
  const hasArweaveAccount = Boolean(activeArweave)
  const isUnlocked = walletManager.isUnlocked

  // Form State
  const [file, setFile] = useState<File | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [encryptUpload, setEncryptUpload] = useState(false)
  const [compressUpload, setCompressUpload] = useState(false)
  const [paymentToken, setPaymentToken] = useState<PaymentToken>("AR")
  const [paymentAccount, setPaymentAccount] = useState<PaymentAccount | null>(
    null,
  )
  const [storageTier, setStorageTier] = useState<"Permanent" | "Term">(
    "Permanent",
  )

  const multipleMode = files.length > 0
  const hasSelection = Boolean(file || multipleMode)

  // Auto-set compression when files change
  useEffect(() => {
    if (file) {
      setCompressUpload(shouldCompressFile(file.size, file.name, file.type))
    } else if (multipleMode) {
      setCompressUpload(
        shouldCompressFile(files[0].size, files[0].name, files[0].type),
      )
    }
  }, [file, files, multipleMode])

  useEffect(() => {
    if (paymentToken === "AR" && storageTier === "Term") {
      setStorageTier("Permanent")
    }
  }, [paymentToken, storageTier])

  const canUpload = Boolean(hasSelection && isUnlocked && paymentAccount)

  const handleUploadClick = async () => {
    let result = { status: "FAILED", success: 0, failed: 1 }

    if (multipleMode) {
      result = await handleBatchUpload(
        files,
        encryptUpload,
        compressUpload,
        paymentToken,
        paymentAccount,
        false,
        storageTier,
      )
    } else if (file) {
      result = await handleUpload(
        file,
        encryptUpload,
        compressUpload,
        paymentToken,
        paymentAccount,
        false,
      )
    }

    if (result.status === "SUCCESS") {
      setFile(null)
      setFiles([])
    }
  }

  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile) {
      setFile(selectedFile)
      setFiles([])
    } else {
      setFile(null)
    }
  }

  const handleFilesSelect = (selectedFiles: File[]) => {
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles)
      setFile(selectedFiles[0]) // Keep first file for preview/metadata focus
    } else {
      setFiles([])
      setFile(null)
    }
  }

  return (
    <div className="mesh-gradient relative min-h-screen pb-20">
      <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto max-w-6xl space-y-5 px-2.5 py-5 duration-1000 sm:space-y-8 sm:px-4 sm:py-8">
        {/* Header Area */}
        <PageHeader
          title={t("common.upload")}
          description={t("upload.arweaveDesc")}
          icon={
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
          }
          iconContainerClassName="bg-gradient-primary"
        />

        <UploadWarning
          isLocked={!hasArweaveAccount || !isUnlocked}
          hasExternalWallet={false}
        />

        {/* Unified Upload Interface */}
        <Card className="glass-premium hover:shadow-primary/5 overflow-hidden border-none shadow-2xl transition-all duration-500">
          <CardContent className="p-0">
            {/* 1. Massive Dropzone Hero Area */}
            <div
              className={`transition-all duration-500 ${hasSelection ? "border-border/50 bg-secondary/10 border-b p-4 pb-2 sm:p-6 sm:pb-2" : "p-5 sm:p-12"}`}
            >
              <FileUploadSection
                file={file}
                files={files}
                onFileSelect={handleFileSelect}
                onFilesSelect={handleFilesSelect}
                disabled={!isUnlocked}
                multiple={true}
              />
            </div>

            {/* 2. Seamlessly Expanded Settings Area (Visible only when file selected) */}
            {hasSelection && (
              <div className="animate-in fade-in slide-in-from-top-4 bg-card/60 flex flex-col gap-5 p-4 sm:gap-6 sm:p-8">
                <div className="grid gap-5 sm:gap-8 lg:grid-cols-12">
                  {/* Left Column: Preview & Options */}
                  <div className="flex flex-col gap-6 lg:col-span-5">
                    {file && <FilePreview file={file} />}

                    <div className="border-border/50 bg-background/50 rounded-xl border p-4 shadow-inner">
                      <UploadOptions
                        encryptUpload={encryptUpload}
                        compressUpload={compressUpload}
                        storageTier={storageTier}
                        disableTermStorage={paymentToken === "AR"}
                        file={file}
                        files={files}
                        isUnlocked={isUnlocked}
                        onEncryptChange={setEncryptUpload}
                        onCompressChange={setCompressUpload}
                        onStorageTierChange={setStorageTier}
                      />
                    </div>
                  </div>

                  {/* Right Column: Payment & Execution */}
                  <div className="flex flex-col gap-6 lg:col-span-7">
                    <div className="border-border/50 bg-background/50 rounded-xl border p-4 shadow-inner sm:p-5">
                      <PaymentTokenSelector
                        selectedToken={paymentToken}
                        selectedAccount={paymentAccount}
                        onSelectToken={setPaymentToken}
                        onSelectAccount={setPaymentAccount}
                      />

                      {!uploading &&
                        !paymentStage &&
                        canUpload &&
                        paymentAccount && (
                          <div className="animate-in fade-in slide-in-from-bottom-2 bg-secondary/30 border-border/40 mt-4 rounded-lg border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                                {t(
                                  "upload.estimatedPath",
                                  "Estimated Payment Path",
                                )}
                              </span>
                              {(() => {
                                const irysToken = getIrysFundingToken(
                                  paymentAccount.chain,
                                  paymentToken,
                                )
                                if (irysToken) {
                                  return (
                                    <span className="flex items-center gap-1.5 rounded-full bg-[hsl(var(--secondary)/0.14)] px-2 py-0.5 text-[9px] font-bold text-[hsl(var(--secondary))] ring-1 ring-[hsl(var(--secondary)/0.25)]">
                                      <ChainIcon
                                        chain={paymentAccount.chain}
                                        size="xs"
                                      />
                                      {t("upload.pathDirect", "DIRECT")}
                                    </span>
                                  )
                                }
                                return (
                                  <span className="flex items-center gap-1.5 rounded-full bg-[hsl(var(--accent)/0.2)] px-2 py-0.5 text-[9px] font-bold text-[hsl(var(--foreground))] ring-1 ring-[hsl(var(--accent)/0.35)]">
                                    <ChainIcon
                                      chain={paymentAccount.chain}
                                      size="xs"
                                    />
                                    {t("upload.payViaIrys", "PAY VIA IRYS")}
                                  </span>
                                )
                              })()}
                            </div>
                          </div>
                        )}
                    </div>

                    {/* Execution Area */}
                    <div className="mt-auto flex flex-col gap-4">
                      {recoveryMessage && (
                        <div className="bg-primary/10 text-primary ring-primary/20 flex items-start gap-2 rounded-lg p-3 text-xs ring-1">
                          <Info className="mt-0.5 h-4 w-4 shrink-0" />
                          <div className="flex-1">
                            <p className="font-semibold">
                              {recoveryState === "COMPLETED"
                                ? t("upload.resumeReady", "Payment Ready")
                                : t(
                                    "upload.resumeTitle",
                                    "Pending Payment Found",
                                  )}
                            </p>
                            <p className="opacity-80">{recoveryMessage}</p>
                          </div>
                          <button
                            onClick={clearRecovery}
                            className="hover:bg-primary/20 rounded-full p-1 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}

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
                            stage:
                              stage ||
                              (paymentStage
                                ? t("upload.processingPayment")
                                : ""),
                            progress: progress,
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Global Info Footers Removed */}
      </div>
    </div>
  )
}
