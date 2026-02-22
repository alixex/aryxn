import { useState, useCallback } from "react"
import { toast } from "sonner"
import { useTranslation } from "@/i18n/config"
import { useWallet } from "@/hooks/account-hooks"
import { uploadFile, uploadFiles } from "@/lib/file"
import type { PaymentToken } from "@/lib/payment"
import { paymentService } from "@/lib/payment"
import type { PaymentAccount } from "@/lib/payment"
import { getIrysFundingToken } from "@/lib/payment"
import type { WalletKey } from "@/lib/utils"
import { useConnectorClient } from "wagmi"
import { clientToSigner } from "@aryxn/wallet-core"
import { PaymentRepository } from "@/lib/payment/payment-repository"
import type { PaymentIntent } from "@/lib/payment/types"
import { useEffect } from "react"

export interface UploadHandlerResult {
  status: "SUCCESS" | "SWAP_REQUIRED" | "BRIDGE_REQUIRED" | "FAILED"
  success: number
  failed: number
}

function resolveWalletKeyForPayment(
  paymentAccount: PaymentAccount,
  wallet: any,
) {
  if (!paymentAccount.isExternal) {
    return wallet.internal.activeWallet
  }

  if (paymentAccount.chain === "solana") {
    return (window as any).solana || null
  }

  if (paymentAccount.chain === "sui") {
    return (window as any).suiWallet || null
  }

  if (paymentAccount.chain === "arweave") {
    return (window as any).arweaveWallet || null
  }

  return null
}

export function useUploadHandler() {
  const { t } = useTranslation()
  const wallet = useWallet()
  const { data: client } = useConnectorClient()

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("")
  const [paymentStage, setPaymentStage] = useState(false)
  const [activeIntent, setActiveIntent] = useState<PaymentIntent | null>(null)
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)

  // Recovery Monitor: Check for pending payments on mount
  useEffect(() => {
    const checkRecovery = async () => {
      const intents = await PaymentRepository.getActiveIntents()
      if (intents.length > 0) {
        const latest = intents[0]
        setActiveIntent(latest)
        setRecoveryMessage(
          t(
            "upload.recoveryDetected",
            "Detected a pending payment for a previous upload: {{file}}",
            {
              file: latest.fileMetadata?.name || "previous file",
            },
          ),
        )
      }
    }
    checkRecovery()
  }, [t])

  const handleUpload = useCallback(
    async (
      file: File,
      encryptUpload: boolean,
      compressUpload: boolean,
      paymentToken: PaymentToken = "AR",
      paymentAccount: PaymentAccount | null,
    ) => {
      if (!file) {
        return {
          status: "FAILED",
          success: 0,
          failed: 1,
        } as UploadHandlerResult
      }

      const activeArweave = wallet.active.arweave
      if (!activeArweave) {
        toast.error(t("upload.needAccountToUpload"))
        return {
          status: "FAILED",
          success: 0,
          failed: 1,
        } as UploadHandlerResult
      }

      if (!paymentAccount) {
        toast.error(
          t("upload.selectPaymentAccount", "Please select a payment account"),
        )
        return {
          status: "FAILED",
          success: 0,
          failed: 1,
        } as UploadHandlerResult
      }

      setUploading(true)
      setProgress(0)
      setStage(t("upload.preparing") || "Preparing...")

      try {
        // Step 1: Handle payment
        setPaymentStage(true)
        setStage(t("upload.processingPayment") || "Processing payment...")

        let signer = undefined
        if (client) {
          signer = clientToSigner(client)
        }

        const walletKey = resolveWalletKeyForPayment(paymentAccount, wallet)

        const paymentResult = await paymentService.executePayment({
          fromToken: paymentToken,
          amountInAR: 0,
          paymentAccount,
          walletKey,
          signer: signer,
          silent: true,
          fileMetadata: {
            name: file.name,
            size: file.size,
            type: file.type,
          },
          intentId: activeIntent?.id,
          onProgress: (p) => {
            setStage(p.message || p.stage)
          },
        })

        if (paymentResult === "PAYMENT_FAILED") {
          throw new Error("Payment execution failed.")
        }

        if (paymentResult === "SILENT_STILL_PENDING") {
          setStage(
            t(
              "upload.waitingForConfirmation",
              "Waiting for on-chain confirmation...",
            ),
          )
          return {
            status: "SUCCESS",
            success: 0,
            failed: 0,
          } as UploadHandlerResult
        }

        if (paymentResult === "REQUIRE_SWAP") {
          return {
            status: "SWAP_REQUIRED",
            success: 0,
            failed: 0,
          } as UploadHandlerResult
        }

        if (paymentResult === "REQUIRE_BRIDGE") {
          toast.info(
            t(
              "common.bridgeRequired",
              "This token requires a bridge. Redirecting to bridge...",
            ),
          )
          // In a real implementation: window.location.href = "/bridge" or showModal()
          return {
            status: "BRIDGE_REQUIRED",
            success: 0,
            failed: 0,
          } as UploadHandlerResult
        }

        const useIrys = paymentResult === "PAID_IRYS"
        setPaymentStage(false)

        const irysTokenName = useIrys
          ? getIrysFundingToken(paymentAccount.chain, paymentToken) || undefined
          : undefined

        setStage(t("upload.uploading") || "Uploading...")
        await uploadFile(
          file,
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
            useIrys: useIrys,
            irysToken: irysTokenName,
          },
        )

        toast.success(t("upload.successArweave"))
        return {
          status: "SUCCESS",
          success: 1,
          failed: 0,
        } as UploadHandlerResult
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        toast.error(
          t("upload.failed", { protocol: "Arweave", message: errorMessage }),
        )
        return {
          status: "FAILED",
          success: 0,
          failed: 1,
        } as UploadHandlerResult
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
      paymentAccount: PaymentAccount | null,
    ) => {
      if (files.length === 0) {
        return {
          status: "FAILED",
          success: 0,
          failed: 0,
        } as UploadHandlerResult
      }

      const activeArweave = wallet.active.arweave
      if (!activeArweave) {
        toast.error(t("upload.needAccountToUpload"))
        return {
          status: "FAILED",
          success: 0,
          failed: files.length,
        } as UploadHandlerResult
      }

      if (!paymentAccount) {
        toast.error(
          t("upload.selectPaymentAccount", "Please select a payment account"),
        )
        return {
          status: "FAILED",
          success: 0,
          failed: files.length,
        } as UploadHandlerResult
      }

      setUploading(true)
      setProgress(0)
      setStage(t("upload.preparing") || "Preparing...")

      let successCount = 0
      let failedCount = 0

      try {
        // Step 1: Handle payment
        setPaymentStage(true)
        setStage(t("upload.processingPayment") || "Processing payment...")

        let signer = undefined
        if (client) {
          signer = clientToSigner(client)
        }

        const walletKey = resolveWalletKeyForPayment(paymentAccount, wallet)

        const paymentResult = await paymentService.executePayment({
          fromToken: paymentToken,
          amountInAR: 0,
          paymentAccount,
          walletKey,
          signer: signer,
          silent: true,
          fileMetadata: {
            name: files[0].name, // Use first file as metadata ref
            size: files.reduce((sum, f) => sum + f.size, 0),
          },
          intentId: activeIntent?.id,
          onProgress: (p) => {
            setStage(p.message || p.stage)
          },
        })

        if (paymentResult === "PAYMENT_FAILED") {
          throw new Error("Payment execution failed.")
        }

        if (paymentResult === "SILENT_STILL_PENDING") {
          setStage(
            t(
              "upload.waitingForConfirmation",
              "Waiting for on-chain confirmation...",
            ),
          )
          return {
            status: "SUCCESS",
            success: 0,
            failed: 0,
          } as UploadHandlerResult
        }

        if (paymentResult === "REQUIRE_SWAP") {
          return {
            status: "SWAP_REQUIRED",
            success: 0,
            failed: 0,
          } as UploadHandlerResult
        }

        if (paymentResult === "REQUIRE_BRIDGE") {
          // toast.info(...) // Handled by Dialog
          return {
            status: "BRIDGE_REQUIRED",
            success: 0,
            failed: 0,
          } as UploadHandlerResult
        }

        const useIrys = paymentResult === "PAID_IRYS"
        setPaymentStage(false)

        const irysTokenName = useIrys
          ? getIrysFundingToken(paymentAccount.chain, paymentToken) || undefined
          : undefined

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
            useIrys: useIrys,
            irysToken: irysTokenName,
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

        return {
          status: successCount > 0 ? "SUCCESS" : "FAILED",
          success: successCount,
          failed: failedCount,
        } as UploadHandlerResult
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        toast.error(t("upload.batchError", { message: errorMessage }))
        return {
          status: "FAILED",
          success: successCount,
          failed: Math.max(failedCount, files.length - successCount),
        } as UploadHandlerResult
      } finally {
        setUploading(false)
        setProgress(0)
        setStage("")
        setPaymentStage(false)
      }
    },
    [wallet, t],
  )

  const clearRecovery = useCallback(async () => {
    if (activeIntent) {
      await PaymentRepository.deleteIntent(activeIntent.id)
      setActiveIntent(null)
      setRecoveryMessage(null)
    }
  }, [activeIntent])

  return {
    uploading,
    paymentStage,
    progress,
    stage,
    recoveryMessage,
    activeIntent,
    clearRecovery,
    handleUpload,
    handleBatchUpload,
  }
}
