import { AlertTriangle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTranslation } from "@/i18n/config"

export default function DangerZone({
  onConfirmClear,
  isClearing,
  open,
  setOpen,
}: {
  onConfirmClear: () => void
  isClearing: boolean
  open: boolean
  setOpen: (v: boolean) => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <div className="border-border/40 mt-4 border-t pt-6">
        <div className="bg-destructive/5 border-destructive/20 flex flex-col justify-between gap-6 rounded-xl border p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <div className="bg-destructive/10 shrink-0 rounded-lg p-2.5">
              <AlertTriangle className="text-destructive h-5 w-5" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-destructive flex items-center gap-2 text-sm font-bold tracking-wide">
                {t("settings.dangerZone", "Danger Zone")}
                <span className="text-destructive/40 font-normal">|</span>
                {t("settings.clearDataTitle", "Clear All Data")}
              </h4>
              <p className="text-muted-foreground/80 max-w-lg text-sm leading-relaxed">
                {t(
                  "settings.clearDataDesc",
                  "This will permanently delete all data including files, folders, accounts, and settings. This action cannot be undone.",
                )}
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            onClick={() => setOpen(true)}
            className="shadow-destructive/20 hover:shadow-destructive/40 w-full shrink-0 font-bold tracking-wide shadow-lg transition-all sm:w-auto"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("settings.clearDataButton", "Clear All Data")}
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-destructive/20 shadow-destructive/10 shadow-2xl">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-destructive flex items-center gap-2 text-xl font-bold">
              <AlertTriangle className="h-6 w-6" />
              {t("settings.confirmTitle", "Confirm Clear All Data")}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium">
              {t(
                "settings.confirmDesc",
                "Are you absolutely sure? This will permanently delete:",
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="bg-destructive/5 border-destructive/20 rounded-xl border p-5">
              <ul className="text-destructive/90 list-disc space-y-2 pl-5 text-sm font-medium">
                <li>{t("settings.confirmItem1", "All files and folders")}</li>
                <li>{t("settings.confirmItem2", "All account information")}</li>
                <li>
                  {t("settings.confirmItem3", "All settings and preferences")}
                </li>
                <li>
                  {t("settings.confirmItem4", "All local database records")}
                </li>
              </ul>
            </div>

            <div className="bg-destructive text-destructive-foreground rounded-lg py-2 text-center text-xs font-extrabold tracking-widest uppercase shadow-inner">
              {t("settings.confirmWarning", "This action cannot be undone!")}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isClearing}
              className="font-medium"
            >
              {t("settings.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirmClear}
              disabled={isClearing}
              className="font-bold shadow-md"
            >
              {isClearing
                ? t("settings.clearing", "Clearing...")
                : t("settings.confirmButton", "Yes, Clear All Data")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
