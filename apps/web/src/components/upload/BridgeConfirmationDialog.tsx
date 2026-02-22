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
import type { UploadRedirectAction } from "@/lib/payment"

interface BridgeConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  token: string
  action: UploadRedirectAction
  sourceChain?: string
  targetChain?: string
}

export function BridgeConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  token,
  action,
  sourceChain = "Ethereum",
  targetChain = "Arweave (Irys)",
}: BridgeConfirmationDialogProps) {
  const { t } = useTranslation()
  const isBridge = action === "bridge"

  const getChainIcon = (chain: string) => {
    const c = chain.toLowerCase()
    if (c.includes("eth")) return "🔷"
    if (c.includes("base")) return "🔵"
    if (c.includes("arb")) return "🫐"
    if (c.includes("opt") || c.includes("op")) return "🔴"
    if (c.includes("sol")) return "☀️"
    if (c.includes("arw") || c.includes("irys")) return "🐘"
    return "🌐"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="bg-primary/10 mx-auto mb-2 rounded-full p-3">
            <ArrowRightLeft className="text-primary h-8 w-8" />
          </div>
          <DialogTitle className="text-center text-xl">
            {isBridge
              ? t("upload.bridgeRequiredTitle", "Cross-Chain Bridge Required")
              : t(
                  "upload.swapRequiredTitle",
                  "Fast Local Swap Required Before Upload",
                )}
          </DialogTitle>
          <DialogDescription className="pt-2 text-center text-sm">
            {isBridge
              ? t("upload.bridgeRequiredDesc", {
                  token,
                  defaultValue:
                    "To pay with {{token}}, a cross-chain bridge transaction is required to move assets to a supported Irys network.",
                })
              : t("upload.swapRequiredDesc", {
                  token,
                  defaultValue:
                    "To pay with {{token}}, we need to perform a quick local swap to Arweave's native storage token first.",
                })}
          </DialogDescription>
        </DialogHeader>

        {/* Route Preview */}
        <div className="bg-muted/30 ring-border/50 flex items-center justify-between rounded-xl p-4 ring-1 ring-inset">
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl">{getChainIcon(sourceChain)}</span>
            <span className="text-[10px] font-bold uppercase opacity-60">
              {sourceChain}
            </span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1 px-4">
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-primary/30 w-full border-t-2 border-dashed" />
              </div>
              <div className="bg-background relative flex items-center justify-center">
                <span className="bg-primary/10 text-primary ring-primary/30 rounded-full px-2 py-0.5 text-[9px] font-black tracking-tighter uppercase ring-1">
                  {isBridge ? "BRIDGE" : "SWAP"}
                </span>
              </div>
            </div>
            <span className="text-muted-foreground text-[10px] italic">
              {isBridge ? "Slow & Secure" : "Fast & Cheap"}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl">{getChainIcon(targetChain)}</span>
            <span className="text-[10px] font-bold uppercase opacity-60">
              {targetChain}
            </span>
          </div>
        </div>

        <div className="space-y-4 py-2">
          <div className="bg-secondary/40 space-y-3 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 text-blue-400" />
              <div>
                <h4 className="text-foreground text-sm font-semibold">
                  {t("upload.redirectTimeTitle", "Estimated Time")}
                </h4>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {isBridge
                    ? t(
                        "upload.bridgeTimeDesc",
                        "~5-10 minutes for block confirmations across chains.",
                      )
                    : t(
                        "upload.swapTimeDesc",
                        "Usually ~30-60 seconds on current network.",
                      )}
                </p>
              </div>
            </div>

            <div className="border-border/50 flex items-start gap-3 border-t pt-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />
              <div>
                <h4 className="text-foreground text-sm font-medium">
                  {t("upload.redirectWarningTitle", "What happens next?")}
                </h4>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {t(
                    "upload.redirectWarningDesc",
                    "The transaction will execute silently. Once confirmed, your file will automatically begin uploading to Arweave.",
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
            {isBridge
              ? t("upload.confirmBridge", "Proceed to Bridge")
              : t("upload.confirmSwap", "Proceed to Swap")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
