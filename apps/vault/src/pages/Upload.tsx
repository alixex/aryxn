import { useState, useEffect, useMemo } from "react"
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
import { paymentService, RouteRequiredError } from "@/lib/payment"
import { FilePreview } from "@/components/ui/file-preview"
import { Card, CardContent } from "@/components/ui/card"
import { Info, X } from "lucide-react"
import { shouldCompressFile, formatFileSize } from "@/lib/utils"
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
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null)
  const [estimatingFee, setEstimatingFee] = useState(false)
  const [estimatedFeeError, setEstimatedFeeError] = useState<string | null>(
    null,
  )

  const multipleMode = files.length > 0
  const hasSelection = Boolean(file || multipleMode)
  const selectedFiles = multipleMode ? files : file ? [file] : []

  const totalSelectedSize = useMemo(
    () => selectedFiles.reduce((sum, current) => sum + current.size, 0),
    [file, files, multipleMode],
  )

  const compressRecommendation = useMemo(
    () => selectedFiles.some((current) => shouldCompressFile(current)),
    [file, files, multipleMode],
  )

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
    let cancelled = false

    const estimateFee = async () => {
      if (!hasSelection || !paymentAccount) {
        setEstimatedFee(null)
        setEstimatedFeeError(null)
        setEstimatingFee(false)
        return
      }

      setEstimatingFee(true)
      setEstimatedFeeError(null)

      try {
        const estimated = await paymentService.estimateFeeInToken(
          totalSelectedSize,
          paymentToken,
          paymentAccount.chain,
        )

        if (cancelled) return

        setEstimatedFee(estimated.formatted)
      } catch (error) {
        if (cancelled) return

        setEstimatedFee(null)

        if (error instanceof RouteRequiredError) {
          const key =
            error.action === "swap"
              ? "upload.feeRouteRequiredSwap"
              : "upload.feeRouteRequiredBridge"

          setEstimatedFeeError(
            t(key, {
              token: paymentToken,
              chain: paymentAccount.chain,
            }),
          )
        } else {
          setEstimatedFeeError(
            t("upload.feeCalculationFailedWithContext", {
              token: paymentToken,
              chain: paymentAccount.chain,
            }),
          )
        }
      } finally {
        if (!cancelled) {
          setEstimatingFee(false)
        }
      }
    }

    void estimateFee()

    return () => {
      cancelled = true
    }
  }, [hasSelection, paymentAccount, paymentToken, t, totalSelectedSize])

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
      <div className="animate-in fade-in slide-in-from-bottom-2 mx-auto max-w-6xl space-y-6 px-3 py-6 duration-700 sm:space-y-8 sm:px-4 sm:py-8">
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
          iconContainerClassName="bg-primary"
        />

        <UploadWarning
          isLocked={!hasArweaveAccount || !isUnlocked}
          hasExternalWallet={false}
        />

        {/* Unified Upload Interface */}
        <Card className="glass-premium hover:shadow-primary/5 overflow-hidden border-none shadow-[0_18px_36px_-30px_hsl(var(--primary)/0.3)] transition-all duration-300">
          <CardContent className="p-0">
            {/* 1. Massive Dropzone Hero Area */}
            <div
              className={`transition-all duration-300 ${hasSelection ? "border-border/50 border-b bg-[hsl(var(--secondary)/0.06)] p-4 pb-2 sm:p-6 sm:pb-2" : "p-5 sm:p-12"}`}
            >
              <FileUploadSection
                file={file}
                files={files}
                onFileSelect={handleFileSelect}
                onFilesSelect={handleFilesSelect}
                disabled={!isUnlocked}
                multiple={true}
              />

              {hasSelection && (
                <div className="border-border/65 mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-[hsl(var(--card)/0.7)] px-3 py-2 text-[11px] sm:text-xs">
                  <span className="bg-muted text-foreground rounded-full px-2 py-1 font-medium">
                    {multipleMode
                      ? t("upload.fileCount", "Files")
                      : t("upload.fileCountSingle", "File")}
                    : {selectedFiles.length}
                  </span>
                  <span className="bg-muted text-foreground rounded-full px-2 py-1 font-medium">
                    {t("upload.totalSize", "Total")}:{" "}
                    {formatFileSize(totalSelectedSize)}
                  </span>
                  <span className="bg-muted text-foreground rounded-full px-2 py-1 font-medium">
                    {t("upload.payment", "Payment")}: {paymentToken}
                  </span>
                  <span className="bg-muted text-foreground rounded-full px-2 py-1 font-medium">
                    {encryptUpload
                      ? t("upload.encryptOn", "Encrypted")
                      : t("upload.encryptOff", "Unencrypted")}
                  </span>
                  {compressRecommendation && (
                    <span className="bg-primary/10 text-primary rounded-full px-2 py-1 font-semibold">
                      {t(
                        "upload.compressionRecommended",
                        "Compression Recommended",
                      )}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-1 font-semibold ${
                      canUpload
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {canUpload
                      ? t("upload.readyToUpload", "Ready")
                      : t("upload.incomplete", "Needs Setup")}
                  </span>
                </div>
              )}
            </div>

            {/* 2. Seamlessly Expanded Settings Area (Visible only when file selected) */}
            {hasSelection && (
              <div className="animate-in fade-in slide-in-from-top-4 bg-card/60 flex flex-col gap-5 p-4 sm:gap-6 sm:p-8">
                <div className="grid gap-5 sm:gap-8 lg:grid-cols-12">
                  {/* Left Column: Preview & Options */}
                  <div className="flex flex-col gap-6 lg:col-span-5">
                    {file && <FilePreview file={file} />}

                    <div className="border-border/50 rounded-xl border bg-[hsl(var(--background)/0.58)] p-4">
                      <UploadOptions
                        encryptUpload={encryptUpload}
                        compressUpload={compressUpload}
                        file={file}
                        files={files}
                        isUnlocked={isUnlocked}
                        onEncryptChange={setEncryptUpload}
                        onCompressChange={setCompressUpload}
                      />
                    </div>
                  </div>

                  {/* Right Column: Payment & Execution */}
                  <div className="flex flex-col gap-6 lg:sticky lg:top-24 lg:col-span-7 lg:self-start">
                    <div className="border-border/50 rounded-xl border bg-[hsl(var(--background)/0.58)] p-4 sm:p-5">
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
                          <div className="animate-in fade-in slide-in-from-bottom-2 border-border/45 mt-4 rounded-lg border bg-[hsl(var(--background)/0.55)] p-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                                const isNativeArPath =
                                  paymentAccount.chain === Chains.ARWEAVE &&
                                  paymentToken === "AR"
                                const isDirectPath =
                                  isNativeArPath || Boolean(irysToken)

                                const baseBadgeClass =
                                  "inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold ring-1"

                                if (isDirectPath) {
                                  return (
                                    <span
                                      className={`${baseBadgeClass} bg-primary/10 text-primary ring-primary/20`}
                                    >
                                      <ChainIcon
                                        chain={paymentAccount.chain}
                                        size="xs"
                                      />
                                      {t("upload.pathDirect", "Direct")}
                                    </span>
                                  )
                                }

                                return (
                                  <span
                                    className={`${baseBadgeClass} bg-muted/75 text-foreground ring-border/80`}
                                  >
                                    <ChainIcon
                                      chain={paymentAccount.chain}
                                      size="xs"
                                    />
                                    {t("upload.payViaIrys", "PAY VIA IRYS")}
                                  </span>
                                )
                              })()}
                            </div>

                            <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
                              {paymentAccount.alias ||
                                `${paymentAccount.address.slice(0, 6)}...${paymentAccount.address.slice(-4)}`}
                              <span className="mx-1">•</span>
                              {paymentAccount.chain}
                              <span className="mx-1">•</span>
                              {paymentToken}
                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="text-muted-foreground font-medium">
                                {t("upload.estimatedFee", "Estimated Fee")}
                              </span>
                              {estimatingFee ? (
                                <span className="text-muted-foreground">
                                  {t(
                                    "upload.calculatingFee",
                                    "Calculating fee...",
                                  )}
                                </span>
                              ) : estimatedFee ? (
                                <span className="text-foreground font-semibold">
                                  {estimatedFee}
                                </span>
                              ) : estimatedFeeError ? (
                                <span className="text-amber-600">
                                  {estimatedFeeError}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  {t(
                                    "upload.feeCalculationFailed",
                                    "Unable to fetch fee information",
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                    </div>

                    {/* Execution Area */}
                    <div className="mt-auto flex flex-col gap-4">
                      {recoveryMessage && (
                        <div className="text-primary rounded-lg bg-[hsl(var(--primary)/0.08)] p-3 text-xs ring-1 ring-[hsl(var(--primary)/0.15)]">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-start gap-2">
                              <Info className="mt-0.5 h-4 w-4 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold">
                                    {recoveryState === "COMPLETED"
                                      ? t("upload.resumeReady", "Payment Ready")
                                      : t(
                                          "upload.resumeTitle",
                                          "Pending Payment Found",
                                        )}
                                  </p>
                                  <span className="bg-primary/10 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-[hsl(var(--primary)/0.18)]">
                                    {recoveryState === "COMPLETED"
                                      ? t("common.ready", "Ready")
                                      : t("common.pending", "Pending")}
                                  </span>
                                </div>
                                <p className="mt-1 wrap-break-word opacity-80">
                                  {recoveryMessage}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={clearRecovery}
                              className="touch-target hover:bg-primary/20 rounded-full p-1 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
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
