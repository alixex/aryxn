import { useState } from "react"
import { BridgeConfirmationDialog } from "./BridgeConfirmationDialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, Info, X } from "lucide-react"
import { useTranslation } from "@/i18n/config"
import { UploadButton } from "./UploadButton"
import { UploadProgress } from "./UploadProgress"
import { useUploadHandler } from "@/hooks/upload-hooks"
import type { UploadHandlerResult } from "@/hooks/upload-hooks"
import {
  getIrysFundingToken,
  resolveUploadRedirectAction,
} from "@/lib/payment/upload-payment-config"
import { ChainIcon } from "@/components/common/ChainIcon"
import type {
  PaymentAccount,
  PaymentToken,
  UploadRedirectAction,
} from "@/lib/payment"

interface UploadExecutionCardProps {
  file: File | null
  files: File[]
  multipleMode: boolean
  encryptUpload: boolean
  compressUpload: boolean
  paymentToken: PaymentToken
  paymentAccount: PaymentAccount | null
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
  paymentAccount,
  canUpload,
  onUploadComplete,
}: UploadExecutionCardProps) {
  /* const { t } = useTranslation() */ // wait, t is used in the hook destructuring? No, t is used in the card too?
  // Let me check if t is used in the card. Yes, many times.
  const { t } = useTranslation()
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

  const [showBridgeDialog, setShowBridgeDialog] = useState(false)
  const [redirectAction, setRedirectAction] =
    useState<UploadRedirectAction>("bridge")

  const handleRedirectConfirm = () => {
    // With silent payment, we no longer navigate away.
    // We just trigger the upload which will wait internally.
    setShowBridgeDialog(false)
    handleUploadClick(true) // forceSilent
  }

  const handleUploadClick = async (forceSilent = false) => {
    let singleResult: UploadHandlerResult = {
      status: "FAILED",
      success: 0,
      failed: 1,
    }
    let batchResult: UploadHandlerResult = {
      status: "FAILED",
      success: 0,
      failed: 0,
    }

    if (multipleMode && files.length > 0) {
      batchResult = await handleBatchUpload(
        files,
        encryptUpload,
        compressUpload,
        paymentToken,
        paymentAccount,
        forceSilent,
      )

      if (
        batchResult.status === "BRIDGE_REQUIRED" ||
        batchResult.status === "SWAP_REQUIRED"
      ) {
        setRedirectAction(
          batchResult.status === "SWAP_REQUIRED" ? "swap" : "bridge",
        )
        setShowBridgeDialog(true)
        return
      }
    } else if (file) {
      singleResult = await handleUpload(
        file,
        encryptUpload,
        compressUpload,
        paymentToken,
        paymentAccount,
        forceSilent,
      )

      if (
        singleResult.status === "BRIDGE_REQUIRED" ||
        singleResult.status === "SWAP_REQUIRED"
      ) {
        setRedirectAction(
          singleResult.status === "SWAP_REQUIRED" ? "swap" : "bridge",
        )
        setShowBridgeDialog(true)
        return
      }
    }

    if (
      (singleResult.status === "SUCCESS" || batchResult.status === "SUCCESS") &&
      onUploadComplete
    ) {
      onUploadComplete()
    }
  }

  return (
    <>
      <BridgeConfirmationDialog
        open={showBridgeDialog}
        onOpenChange={setShowBridgeDialog}
        onConfirm={handleRedirectConfirm}
        token={paymentToken}
        action={redirectAction}
        sourceChain={paymentAccount?.chain || "Ethereum"}
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
          {recoveryMessage && (
            <div className="animate-in fade-in slide-in-from-top-4 bg-primary/10 text-primary ring-primary/20 flex items-start gap-2 rounded-lg p-3 text-xs ring-1 duration-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">
                  {recoveryState === "COMPLETED"
                    ? t("upload.resumeReady", "Payment Ready")
                    : t("upload.resumeTitle", "Pending Payment Found")}
                </p>
                <p className="opacity-80">{recoveryMessage}</p>
                {recoveryState === "COMPLETED" && (
                  <p className="mt-1 font-medium italic">
                    {t(
                      "upload.resumeHint",
                      "Select your file again to complete the upload.",
                    )}
                  </p>
                )}
              </div>
              <button
                onClick={clearRecovery}
                className="hover:bg-primary/20 rounded-full p-1 transition-colors"
                title={t("upload.clearRecovery", "Dismiss")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {!uploading && !paymentStage && canUpload && paymentAccount && (
            <div className="animate-in fade-in slide-in-from-bottom-2 bg-secondary/30 border-border/40 space-y-2 rounded-xl border p-3 duration-500">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  {t("upload.estimatedPath", "Estimated Payment Path")}
                </span>
                {(() => {
                  const irysToken = getIrysFundingToken(
                    paymentAccount.chain,
                    paymentToken,
                  )
                  if (irysToken) {
                    return (
                      <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-500 ring-1 ring-emerald-500/20">
                        <ChainIcon chain={paymentAccount.chain} size="xs" />
                        {t("upload.pathDirect", "DIRECT")}
                      </span>
                    )
                  }
                  const redirect = resolveUploadRedirectAction(
                    paymentAccount.chain,
                    paymentToken,
                  )
                  return (
                    <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-500 ring-1 ring-amber-500/20">
                      <ChainIcon chain={paymentAccount.chain} size="xs" />
                      {redirect === "swap"
                        ? t("upload.pathSwap", "SWAP")
                        : t("upload.pathBridge", "BRIDGE")}
                    </span>
                  )
                })()}
              </div>
              <p className="text-foreground/80 text-[11px] leading-relaxed">
                {(() => {
                  const irysToken = getIrysFundingToken(
                    paymentAccount.chain,
                    paymentToken,
                  )
                  if (irysToken) {
                    return t("upload.pathDirectDesc", {
                      token: paymentToken,
                      chain: paymentAccount.chain,
                      defaultValue:
                        "Native {{token}} on {{chain}} is supported directly. Instant payment.",
                    })
                  }
                  const redirect = resolveUploadRedirectAction(
                    paymentAccount.chain,
                    paymentToken,
                  )
                  if (redirect === "swap") {
                    return t("upload.pathSwapDesc", {
                      token: paymentToken,
                      defaultValue:
                        "Will perform a fast local swap from {{token}} before payment.",
                    })
                  }
                  return t("upload.pathBridgeDesc", {
                    token: paymentToken,
                    defaultValue:
                      "Requires cross-chain bridge for {{token}} payment. Takes ~10m.",
                  })
                })()}
              </p>
            </div>
          )}

          <UploadButton
            uploading={uploading}
            file={file}
            canUpload={canUpload}
            encryptUpload={encryptUpload}
            onClick={handleUploadClick}
          />

          {!uploading && !paymentStage && canUpload && (
            <p className="animate-in fade-in text-muted-foreground/60 text-center text-[10px] italic duration-700">
              {paymentToken === "BTC"
                ? t(
                    "upload.transparency.slow",
                    "BTC takes 30-60m. You can close this page after initiating.",
                  )
                : t(
                    "upload.transparency.default",
                    "Exchanges may take 5-10m. Funds are safe if you refresh.",
                  )}
            </p>
          )}

          {(uploading || paymentStage) && (
            <UploadProgress
              progress={{
                stage:
                  stage || (paymentStage ? t("upload.processingPayment") : ""),
                progress: progress,
              }}
            />
          )}
        </CardContent>
      </Card>
    </>
  )
}
