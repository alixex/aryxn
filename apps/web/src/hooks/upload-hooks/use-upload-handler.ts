import { useState, useCallback } from "react"
import { toast } from "sonner"
import { useTranslation } from "@/i18n/config"
import { useWallet } from "@/hooks/account-hooks"
import { uploadFile, uploadFiles } from "@/lib/file"
import type { PaymentToken } from "@/lib/payment"
import { paymentService } from "@/lib/payment"
import type { WalletKey } from "@/lib/utils"

export function useUploadHandler() {
  const { t } = useTranslation()
  const wallet = useWallet()

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [paymentStage, setPaymentStage] = useState(false)

  const handleUpload = useCallback(
    async (
      file: File,
      encryptUpload: boolean,
      compressUpload: boolean,
      paymentToken: PaymentToken = "AR",
    ) => {
      if (!file) return false

      const activeArweave = wallet.active.arweave
      if (!activeArweave) {
        toast.error(t("upload.needAccountToUpload"))
        return false
      }

      setUploading(true)
      setProgress(0)
      setStage(t("upload.preparing") || "Preparing...")

      try {
        // Step 1: Handle non-AR payment via DEX swap
        if (paymentToken !== "AR") {
          setPaymentStage(true)
          setStage(
            t("upload.processingPayment") || "Processing payment via DEX...",
          )

          await paymentService.executePayment({
            fromToken: paymentToken,
            amountInAR: 0, // In a real scenario, we'd pass the actual estimated AR fee
            userAddress:
              wallet.active.evm?.address || wallet.active.solana?.address || "",
            walletKey: null, // Connection handled by wallet providers
          })

          setPaymentStage(false)
        }

        setStage(t("upload.uploading") || "Uploading...")
        const { txId } = await uploadFile(
          file,
          activeArweave.address,
          activeArweave.isExternal
            ? (null as unknown as WalletKey)
            : wallet.internal.activeWallet!,
          {
            encryptionKey: encryptUpload ? new Uint8Array(32) : undefined, // Placeholder, actual key managed in file-manager
            useExternalWallet: activeArweave.isExternal,
            enableCompression: compressUpload,
            onProgress: (p) => {
              setProgress(p.progress)
              setStage(p.stage)
            },
          },
        )

        toast.success(t("upload.successArweave"))
        return true
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        toast.error(
          t("upload.failed", { protocol: "Arweave", message: errorMessage }),
        )
        return false
      } finally {
        setUploading(false)
        setProgress(0)
        setStage("")
        setPaymentStage(false)
      }
    },
    [wallet, t],
  )

  const handleBatchUpload = useCallback(
    async (
      files: File[],
      encryptUpload: boolean,
      compressUpload: boolean,
      paymentToken: PaymentToken = "AR",
    ) => {
      if (files.length === 0) {
        return { success: 0, failed: 0 }
      }

      const activeArweave = wallet.active.arweave
      if (!activeArweave) {
        toast.error(t("upload.needAccountToUpload"))
        return { success: 0, failed: 0 }
      }

      setUploading(true)
      setProgress(0)
      setStage(t("upload.preparing") || "Preparing...")

      let successCount = 0
      let failedCount = 0

      try {
        // Handle non-AR payment
        if (paymentToken !== "AR") {
          setPaymentStage(true)
          setStage(
            t("upload.processingPayment") || "Processing payment via DEX...",
          )
          await paymentService.executePayment({
            fromToken: paymentToken,
            amountInAR: 0,
            userAddress:
              wallet.active.evm?.address || wallet.active.solana?.address || "",
            walletKey: null,
          })
          setPaymentStage(false)
        }

        setStage(t("upload.uploading") || "Uploading...")
        const results = await uploadFiles(
          files,
          activeArweave.address,
          activeArweave.isExternal
            ? (null as unknown as WalletKey)
            : wallet.internal.activeWallet!,
          {
            encryptionKey: encryptUpload ? new Uint8Array(32) : undefined,
            useExternalWallet: activeArweave.isExternal,
            enableCompression: compressUpload,
            onProgress: (p) => {
              setProgress(p.progress)
              setStage(p.stage)
            },
          },
        )

        successCount = results.filter((r) => r.success).length
        failedCount = results.filter((r) => !r.success).length

        if (successCount > 0) {
          try {
            const { scheduleManifestUpdate } = await import("@/lib/file")
            scheduleManifestUpdate(
              activeArweave.address,
              activeArweave.isExternal
                ? (null as unknown as WalletKey)
                : wallet.internal.activeWallet!,
              activeArweave.isExternal,
            )
          } catch (error) {
            console.error(
              "[BatchUpload] Failed to schedule manifest update:",
              error,
            )
          }
        }

        if (successCount > 0) {
          toast.success(
            t("upload.batchSuccess", {
              success: successCount,
              total: files.length,
            }),
          )
        }

        if (failedCount > 0) {
          toast.error(
            t("upload.batchFailed", {
              failed: failedCount,
              total: files.length,
            }),
          )
        }

        return { success: successCount, failed: failedCount }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        toast.error(t("upload.batchError", { message: errorMessage }))
        return { success: successCount, failed: failedCount }
      } finally {
        setUploading(false)
        setProgress(0)
        setStage("")
        setPaymentStage(false)
      }
    },
    [wallet, t],
  )

  return {
    uploading,
    paymentStage,
    progress,
    stage,
    handleUpload,
    handleBatchUpload,
  }
}
