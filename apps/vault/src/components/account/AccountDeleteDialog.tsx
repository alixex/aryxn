import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Trash2 } from "lucide-react"
import { Chains } from "@aryxn/chain-constants"
import { useTranslation } from "@/i18n/config"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AccountDeleteDialogProps {
  open: boolean
  account: {
    id?: string | number
    chain: string
    address: string
    alias: string
    isExternal: boolean
  } | null
  isDeleting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

const AR_DELETE_COUNTDOWN_SECONDS = 6

export function AccountDeleteDialog({
  open,
  account,
  isDeleting = false,
  onOpenChange,
  onConfirm,
}: AccountDeleteDialogProps) {
  const { t } = useTranslation()
  const [secondsLeft, setSecondsLeft] = useState(0)

  const isArweave = account?.chain === Chains.ARWEAVE
  const displayName =
    account?.alias ||
    account?.address ||
    t("common.none", { defaultValue: "N/A" })

  useEffect(() => {
    if (!open || !account) {
      setSecondsLeft(0)
      return
    }

    setSecondsLeft(AR_DELETE_COUNTDOWN_SECONDS)
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [open, account])

  const deleteDisabled = isDeleting || secondsLeft > 0 || !account

  const deleteLabel = useMemo(() => {
    if (secondsLeft > 0) {
      return t("identities.deleteAccountCountdownButton", {
        seconds: secondsLeft,
      })
    }
    return t("identities.deleteAccountConfirm")
  }, [isArweave, secondsLeft, t])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="bg-destructive/10 border-destructive/30 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border">
            <Trash2 className="text-destructive h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">
            {t("identities.deleteAccountTitle")}
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            {t("identities.deleteAccountDesc", { alias: displayName })}
          </DialogDescription>
        </DialogHeader>

        <div className="border-destructive/40 bg-destructive/10 rounded-xl border p-4">
          <div className="text-destructive flex items-start gap-2 text-sm font-semibold">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t("identities.deleteAccountWarningTitle")}</span>
          </div>
          <p className="text-destructive/90 mt-2 text-xs leading-relaxed">
            {t("identities.deleteAccountWarningDesc")}
          </p>
        </div>

        {isArweave && (
          <div className="border-destructive/40 bg-destructive/10 rounded-xl border p-4">
            <div className="text-destructive flex items-start gap-2 text-sm font-semibold">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t("identities.deleteArWarningTitle")}</span>
            </div>
            <p className="text-destructive/90 mt-2 text-xs leading-relaxed">
              {t("identities.deleteArWarningDesc")}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={deleteDisabled}
          >
            {deleteLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
