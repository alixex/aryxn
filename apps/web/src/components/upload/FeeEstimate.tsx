import { useTranslation } from "@/i18n/config"
import { Calculator, Loader2, Zap } from "lucide-react"
import { formatFileSize, formatTimestamp } from "@/lib/utils"
import type { FeeEstimate } from "@/hooks/dex-hooks"
import type { PaymentToken } from "@/lib/payment"

interface FeeEstimateProps {
  file: File | null
  files?: File[]
  estimatedFee: FeeEstimate | null
  calculatingFee: boolean
  feeError: string | null
  encryptUpload: boolean
  compressUpload: boolean
  shouldCompressFile: (size: number, name: string, type: string) => boolean
  selectedToken: PaymentToken
}

export function FeeEstimate({
  file,
  files = [],
  estimatedFee,
  calculatingFee,
  feeError,
  encryptUpload,
  compressUpload,
  shouldCompressFile,
  selectedToken,
}: FeeEstimateProps) {
  const { t } = useTranslation()

  const displayFiles = files.length > 0 ? files : file ? [file] : []
  if (displayFiles.length === 0) return null

  const totalSize = displayFiles.reduce((sum, f) => sum + f.size, 0)
  const isMultiple = files.length > 0

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="glass-strong animate-fade-in-down border-accent/30 bg-card/60 rounded-t-xl border-b-2 p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-accent/20 rounded-lg p-1.5">
            <Calculator className="text-foreground h-4 w-4" />
          </div>
          <span className="text-foreground text-sm font-bold">
            {t("upload.estimatedFee")}
          </span>
          {calculatingFee && (
            <Loader2 className="text-foreground h-3 w-3 animate-spin" />
          )}
          {!calculatingFee && estimatedFee?.timestamp && (
            <span className="text-muted-foreground/50 ml-auto text-[10px] font-medium">
              {formatTimestamp(estimatedFee.timestamp)}
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        {feeError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
            <div className="text-xs font-medium text-amber-800">{feeError}</div>
            <div className="mt-1 text-xs text-amber-700">
              {t("upload.feeErrorHint")}
            </div>
          </div>
        ) : estimatedFee ? (
          <div className="space-y-3">
            {/* AR 费用显示 */}
            <div className="bg-background rounded-lg p-4">
              <div className="text-muted-foreground mb-2 text-xs font-medium">
                {t("upload.feeInAR")}
              </div>
              <div className="text-foreground text-2xl font-bold">
                {selectedToken === "AR"
                  ? `${estimatedFee.ar.toFixed(6)} AR`
                  : `${estimatedFee.estimatedFeesByToken?.[selectedToken]?.toFixed(6) || "0.000000"} ${selectedToken}`}
              </div>
              {selectedToken !== "AR" && (
                <div className="text-muted-foreground mt-1 text-xs">
                  ≈ {estimatedFee.ar.toFixed(6)} AR
                </div>
              )}
              {estimatedFee.manifestFeeAR !== undefined &&
                estimatedFee.manifestFeeAR > 0 && (
                  <div className="border-border mt-2 flex items-center justify-between border-t pt-2 text-xs">
                    <span className="text-muted-foreground">
                      {t("upload.fileFee") || "文件费用"}:
                    </span>
                    <span className="text-foreground font-medium">
                      {selectedToken === "AR"
                        ? `${(estimatedFee.ar - estimatedFee.manifestFeeAR).toFixed(6)} AR`
                        : `${((estimatedFee.estimatedFeesByToken?.[selectedToken] || 0) * ((estimatedFee.ar - estimatedFee.manifestFeeAR) / estimatedFee.ar)).toFixed(6)} ${selectedToken}`}
                    </span>
                  </div>
                )}
              {estimatedFee.manifestFeeAR !== undefined &&
                estimatedFee.manifestFeeAR > 0 && (
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {t("upload.manifestFee") || "清单文件费用"}:
                    </span>
                    <span className="text-foreground font-medium">
                      {estimatedFee.manifestFeeAR.toFixed(6)} AR
                    </span>
                  </div>
                )}
            </div>

            {/* 压缩信息显示 */}
            {estimatedFee.originalSize !== undefined &&
              estimatedFee.compressedSize !== undefined &&
              estimatedFee.savedFeeAR !== undefined &&
              estimatedFee.savedFeeAR > 0 && (
                <div className="space-y-2 rounded-lg border border-green-200 bg-green-50/50 p-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-semibold text-green-900">
                      {t("upload.compressionSavings")}
                    </span>
                  </div>
                  <div className="space-y-1.5 pl-6">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {t("upload.originalSize")}:
                      </span>
                      <span className="text-foreground font-medium">
                        {formatFileSize(estimatedFee.originalSize)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {t("upload.compressedSize")}:
                      </span>
                      <span className="font-medium text-green-700">
                        {formatFileSize(estimatedFee.compressedSize)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-green-200/50 pt-1.5 text-xs">
                      <span className="font-semibold text-green-900">
                        {t("upload.savedFee")}:
                      </span>
                      <span className="font-bold text-green-700">
                        {estimatedFee.savedFeeAR.toFixed(6)} AR
                      </span>
                    </div>
                  </div>
                </div>
              )}

            {/* 文件信息 */}
            <div className="bg-secondary/30 space-y-2 rounded-lg px-3 py-2">
              {isMultiple ? (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {t("upload.filesSelected")}: {files.length}
                    </span>
                    <span className="text-foreground font-medium">
                      {formatFileSize(totalSize)}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-[10px]">
                    {t("upload.feeEstimatedNote")}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="text-muted-foreground text-[10px]">
                    {t("upload.fileSize")}:
                  </div>
                  <div className="text-foreground text-xs font-medium">
                    {formatFileSize(file!.size)}
                  </div>
                  {encryptUpload && (
                    <>
                      <span className="text-muted-foreground/30">•</span>
                      <div className="text-muted-foreground text-[10px]">
                        {t("upload.encrypted")}
                      </div>
                    </>
                  )}
                  {compressUpload &&
                    file &&
                    shouldCompressFile(file.size, file.name, file.type) && (
                      <>
                        <span className="text-muted-foreground/30">•</span>
                        <div className="text-muted-foreground text-[10px]">
                          {t("upload.compressed")}
                        </div>
                      </>
                    )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-foreground flex items-center gap-2 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("upload.calculatingFee")}
          </div>
        )}
      </div>
    </div>
  )
}
