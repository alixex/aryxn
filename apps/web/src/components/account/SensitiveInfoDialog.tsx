import { useState } from "react"
import { useTranslation } from "@/i18n/config"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eye, EyeOff, ShieldAlert, Download } from "lucide-react"
import { toast } from "sonner"
import { exportWallet } from "@/lib/wallet-export"
import type { WalletRecord } from "@/lib/types"

interface SensitiveInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: WalletRecord | null
  type: "key" | "mnemonic"
  onVerify: (password: string) => Promise<{
    key: string
    mnemonic?: string
  } | null>
}

export function SensitiveInfoDialog({
  open,
  onOpenChange,
  account,
  type,
  onVerify,
}: SensitiveInfoDialogProps) {
  const { t } = useTranslation()
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [decryptedInfo, setDecryptedInfo] = useState<{
    key: string
    mnemonic?: string
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleVerify = async () => {
    setLoading(true)
    try {
      const info = await onVerify(confirmPassword)
      setDecryptedInfo(info)
      setConfirmPassword("")
    } catch {
      // Error handled by onVerify
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setConfirmPassword("")
    setDecryptedInfo(null)
    onOpenChange(false)
  }

  const handleDownload = () => {
    if (!decryptedInfo || !account) return

    try {
      exportWallet({
        chain: account.chain || "unknown",
        alias: account.alias,
        address: account.address,
        type,
        content: decryptedInfo,
      })

      toast.success(t("identities.downloadSuccess"))
    } catch (error) {
      console.error("Download failed:", error)
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(t("identities.downloadFailed", { message: errorMessage }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="top-4 flex max-h-[calc(100vh-2rem)] max-w-2xl translate-y-0 flex-col sm:top-[50%] sm:translate-y-[-50%]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            {type === "key"
              ? t("identities.viewSensitive")
              : t("identities.mnemonic")}
          </DialogTitle>
          <DialogDescription>
            {t("identities.sensitiveWarning")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!decryptedInfo ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-800">
                  {t("identities.confirmPassword")}
                </p>
              </div>
              <div className="relative px-2">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={t("unlock.passwordPlaceholder")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loading) {
                      handleVerify()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-5 -translate-y-1/2 transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <Button
                onClick={handleVerify}
                disabled={!confirmPassword || loading}
                className="w-full"
              >
                {loading ? t("common.loading") : t("identities.verify")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">
                  {t("identities.dangerZone")}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-foreground text-sm font-semibold">
                  {type === "key"
                    ? t("identities.privateKey")
                    : t("identities.mnemonic")}
                </label>
                <div className="border-border bg-secondary max-h-[50vh] overflow-y-auto rounded-lg border p-4">
                  <p className="text-foreground font-mono text-sm break-all whitespace-pre-wrap">
                    {type === "key"
                      ? decryptedInfo.key
                      : decryptedInfo.mnemonic}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮固定在底部 */}
        {decryptedInfo && (
          <div className="border-border shrink-0 space-y-2 border-t pt-4">
            <Button onClick={handleDownload} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              {t("identities.download")}
            </Button>
            <Button onClick={handleClose} variant="outline" className="w-full">
              {t("common.close")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
