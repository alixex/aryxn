import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/config"
import { ArrowRightLeft, Clock, AlertTriangle } from "lucide-react"

interface BridgeConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  token: string
}

export function BridgeConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  token,
}: BridgeConfirmationDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 rounded-full bg-amber-500/10 p-3">
            <ArrowRightLeft className="h-8 w-8 text-amber-500" />
          </div>
          <DialogTitle className="text-center text-xl">
            {t("upload.bridgeRequiredTitle", "Cross-Chain Bridge Required")}
          </DialogTitle>
          <DialogDescription className="pt-2 text-center">
            {t(
              "upload.bridgeRequiredDesc",
              `To pay with ${token}, a cross-chain bridge transaction is required.`,
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-secondary/50 space-y-3 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 text-blue-400" />
              <div>
                <h4 className="text-foreground text-sm font-medium">
                  {t("upload.bridgeTimeTitle", "Estimated Time")}
                </h4>
                <p className="text-muted-foreground text-xs">
                  {t(
                    "upload.bridgeTimeDesc",
                    "~5-10 minutes for block confirmations.",
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />
              <div>
                <h4 className="text-foreground text-sm font-medium">
                  {t("upload.bridgeCostTitle", "Network Fees")}
                </h4>
                <p className="text-muted-foreground text-xs">
                  {t(
                    "upload.bridgeCostDesc",
                    "Additional gas fees apply for the bridge transaction.",
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-center">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="sm:w-32"
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
            className="bg-amber-500 text-white hover:bg-amber-600 sm:w-32"
          >
            {t("upload.confirmBridge", "Proceed to Bridge")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
