import { useState, useCallback, useEffect } from "react"
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
  const [recoveryState, setRecoveryState] = useState<
    "NONE" | "PENDING" | "READY_TO_FUND" | "COMPLETED"
  >("NONE")

  // Recovery Monitor: Check for pending payments on mount
  useEffect(() => {
    const checkRecovery = async () => {
      const intents = await PaymentRepository.getActiveIntents()
      if (intents.length > 0) {
        const latest = intents[0]
        setActiveIntent(latest)

        if (latest.status === "PENDING") {
          setRecoveryState("PENDING")
          setRecoveryMessage(
            t(
              "upload.recoveryDetected",
              "Detected a pending payment for a previous upload: {{file}}",
              { file: latest.fileMetadata?.name || "previous file" },
            ),
          )
        } else if (latest.status === "COMPLETED") {
          setRecoveryState("COMPLETED")
          setRecoveryMessage(
            t(
              "upload.resumeReady",
              "Payment confirmed for previous upload: {{file}}. Ready to upload.",
              { file: latest.fileMetadata?.name || "previous file" },
            ),
          )
        }
      }
    }
    checkRecovery()
  }, [t])

  const waitForPayment = useCallback(
    async (intentId: string) => {
      setStage(t("upload.waitingForConfirmation"))
      return new Promise<boolean>((resolve) => {
        const interval = setInterval(async () => {
          const intent = await PaymentRepository.getIntent(intentId)
          if (intent?.status === "COMPLETED") {
            clearInterval(interval)
            resolve(true)
          } else if (intent?.status === "FAILED") {
            clearInterval(interval)
            resolve(false)
          }
        }, 5000)
      })
    },
    [t],
  )

  const handleUpload = useCallback(
    async (
      file: File,
      encryptUpload: boolean,
      compressUpload: boolean,
      paymentToken: PaymentToken = "AR",
      paymentAccount: PaymentAccount | null,
      forceSilent = false,
    ) => {
      if (!file) {
        return {
          status: "FAILED",
          success: 0,
          failed: 1,
        } as UploadHandlerResult
      }

      let activeArweave = wallet.active.arweave

      if (!activeArweave) {
        if (wallet.internal.isUnlocked) {
          try {
            setStage(
              t("upload.autoCreateArPreparing", "Preparing your AR account..."),
            )
            await wallet.internal.createWallet("arweave", "Vault AR")
            // refresh wallet state to get the new address immediately
            await wallet.internal.refreshWallets()
            const newArweave = wallet.internal.wallets.find(
              (w: any) => w.chain === "arweave",
            )
            if (newArweave) {
              activeArweave = {
                ...newArweave,
                isExternal: false,
                chain: "arweave" as const,
              } as any // Use as any to bypass complex ActiveAccount union types for now, since we know it's valid
              toast.success(
                t(
                  "upload.autoCreateArSuccess",
                  "AR account created and switched automatically: Vault AR",
                  { alias: "Vault AR" },
                ),
              )
            } else {
              throw new Error("Generation successful but couldn't find wallet")
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            toast.error(
              t(
                "upload.autoCreateArFailed",
                "Failed to create AR account: {{message}}",
                { message: errorMessage },
              ),
            )
            return {
              status: "FAILED",
              success: 0,
              failed: 1,
            } as UploadHandlerResult
          }
        } else {
          toast.error(t("upload.needAccountToUpload"))
          return {
            status: "FAILED",
            success: 0,
            failed: 1,
          } as UploadHandlerResult
        }
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
      setStage(t("upload.preparing"))

      try {
        // Step 1: Handle payment
        setPaymentStage(true)
        setStage(t("upload.processingPayment"))

        let signer = undefined
        if (client) {
          signer = clientToSigner(client)
        }

        const walletKey = resolveWalletKeyForPayment(paymentAccount, wallet)

        let paymentResult = await paymentService.executePayment({
          fromToken: paymentToken,
          amountInAR: 0,
          paymentAccount,
          walletKey,
          signer: signer,
          silent: forceSilent || paymentToken === "AR", // AR never needs confirmation
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

        if (
          paymentResult === "REQUIRE_SWAP" ||
          paymentResult === "REQUIRE_BRIDGE"
        ) {
          return {
            status:
              paymentResult === "REQUIRE_SWAP"
                ? "SWAP_REQUIRED"
                : "BRIDGE_REQUIRED",
            success: 0,
            failed: 0,
          } as UploadHandlerResult
        }

        // Handle Silent Waiting
        if (paymentResult === "SILENT_STILL_PENDING") {
          // Get the intent ID (either from activeIntent or the one just created by executePayment)
          const intents = await PaymentRepository.getActiveIntents()
          const currentIntent = intents.find(
            (i) => i.fileMetadata?.name === file.name,
          )

          if (currentIntent) {
            setActiveIntent(currentIntent)
            const success = await waitForPayment(currentIntent.id)
            if (!success) throw new Error("Silent payment failed during wait.")
            paymentResult = "PAID_IRYS" // Assume it ended up as Irys funding
          }
        }

        if (paymentResult === "PAYMENT_FAILED") {
          throw new Error("Payment execution failed.")
        }

        const useIrys =
          paymentResult === "PAID_IRYS" || paymentResult === "PAID_NATIVE"
        setPaymentStage(false)

        const irysTokenName = useIrys
          ? getIrysFundingToken(paymentAccount.chain, paymentToken) || undefined
          : undefined

        setStage(t("upload.uploading"))
        await uploadFile(
          file,
          activeArweave!.address,
          activeArweave!.isExternal
            ? (null as unknown as WalletKey)
            : wallet.internal.activeWallet!,
          {
            encryptionKey: encryptUpload ? new Uint8Array(32) : undefined,
            useExternalWallet: activeArweave!.isExternal,
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

        // Cleanup Intent on Full Success
        const intents = await PaymentRepository.getActiveIntents()
        const finalizedIntent = intents.find(
          (i) => i.fileMetadata?.name === file.name,
        )
        if (finalizedIntent) {
          await PaymentRepository.deleteIntent(finalizedIntent.id)
          setActiveIntent(null)
          setRecoveryMessage(null)
          setRecoveryState("NONE")
        }

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
    [wallet, t, client, activeIntent, waitForPayment],
  )

  const handleBatchUpload = useCallback(
    async (
      files: File[],
      encryptUpload: boolean,
      compressUpload: boolean,
      paymentToken: PaymentToken = "AR",
      paymentAccount: PaymentAccount | null,
      forceSilent = false,
    ) => {
      if (files.length === 0) {
        return {
          status: "FAILED",
          success: 0,
          failed: 0,
        } as UploadHandlerResult
      }

      let activeArweave = wallet.active.arweave

      if (!activeArweave) {
        if (wallet.internal.isUnlocked) {
          try {
            setStage(
              t("upload.autoCreateArPreparing", "Preparing your AR account..."),
            )
            await wallet.internal.createWallet("arweave", "Vault AR")
            // refresh wallet state to get the new address immediately
            await wallet.internal.refreshWallets()
            const newArweave = wallet.internal.wallets.find(
              (w: any) => w.chain === "arweave",
            )
            if (newArweave) {
              activeArweave = {
                ...newArweave,
                isExternal: false,
                chain: "arweave" as const,
              } as any
              toast.success(
                t(
                  "upload.autoCreateArSuccess",
                  "AR account created and switched automatically: Vault AR",
                  { alias: "Vault AR" },
                ),
              )
            } else {
              throw new Error("Generation successful but couldn't find wallet")
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            toast.error(
              t(
                "upload.autoCreateArFailed",
                "Failed to create AR account: {{message}}",
                { message: errorMessage },
              ),
            )
            return {
              status: "FAILED",
              success: 0,
              failed: files.length,
            } as UploadHandlerResult
          }
        } else {
          toast.error(t("upload.needAccountToUpload"))
          return {
            status: "FAILED",
            success: 0,
            failed: files.length,
          } as UploadHandlerResult
        }
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
      setStage(t("upload.preparing"))

      let successCount = 0
      let failedCount = 0

      try {
        // Step 1: Handle payment
        setPaymentStage(true)
        setStage(t("upload.processingPayment"))

        let signer = undefined
        if (client) {
          signer = clientToSigner(client)
        }

        const walletKey = resolveWalletKeyForPayment(paymentAccount, wallet)

        let paymentResult = await paymentService.executePayment({
          fromToken: paymentToken,
          amountInAR: 0,
          paymentAccount,
          walletKey,
          signer: signer,
          silent: forceSilent || paymentToken === "AR",
          fileMetadata: {
            name: files[0].name, // Use first file as metadata ref
            size: files.reduce((sum, f) => sum + f.size, 0),
          },
          intentId: activeIntent?.id,
          onProgress: (p) => {
            setStage(p.message || p.stage)
          },
        })

        if (
          paymentResult === "REQUIRE_SWAP" ||
          paymentResult === "REQUIRE_BRIDGE"
        ) {
          return {
            status:
              paymentResult === "REQUIRE_SWAP"
                ? "SWAP_REQUIRED"
                : "BRIDGE_REQUIRED",
            success: 0,
            failed: 0,
          } as UploadHandlerResult
        }

        // Handle Silent Waiting for Batch
        if (paymentResult === "SILENT_STILL_PENDING") {
          const intents = await PaymentRepository.getActiveIntents()
          const currentIntent = intents.find(
            (i) => i.fileMetadata?.name === files[0].name,
          )

          if (currentIntent) {
            setActiveIntent(currentIntent)
            const success = await waitForPayment(currentIntent.id)
            if (!success) throw new Error("Silent payment failed during wait.")
            paymentResult = "PAID_IRYS"
          }
        }

        if (paymentResult === "PAYMENT_FAILED") {
          throw new Error("Payment execution failed.")
        }

        const useIrys =
          paymentResult === "PAID_IRYS" || paymentResult === "PAID_NATIVE"
        setPaymentStage(false)

        const irysTokenName = useIrys
          ? getIrysFundingToken(paymentAccount.chain, paymentToken) || undefined
          : undefined

        setStage(t("upload.uploading"))
        const results = await uploadFiles(
          files,
          activeArweave!.address,
          activeArweave!.isExternal
            ? (null as unknown as WalletKey)
            : wallet.internal.activeWallet!,
          {
            encryptionKey: encryptUpload ? new Uint8Array(32) : undefined,
            useExternalWallet: activeArweave!.isExternal,
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
              activeArweave!.address,
              activeArweave!.isExternal
                ? (null as unknown as WalletKey)
                : wallet.internal.activeWallet!,
              activeArweave!.isExternal,
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

          // Cleanup Intent on Full Success
          const intents = await PaymentRepository.getActiveIntents()
          const finalizedIntent = intents.find(
            (i) => i.fileMetadata?.name === files[0].name,
          )
          if (finalizedIntent) {
            await PaymentRepository.deleteIntent(finalizedIntent.id)
            setActiveIntent(null)
            setRecoveryMessage(null)
            setRecoveryState("NONE")
          }
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
    [wallet, t, client, activeIntent, waitForPayment],
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
    recoveryState,
    activeIntent,
    clearRecovery,
    handleUpload,
    handleBatchUpload,
  }
}
