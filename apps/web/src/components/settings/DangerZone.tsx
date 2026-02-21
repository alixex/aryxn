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
      <div className="glass-premium hover:shadow-destructive/10 mt-6 mb-8 border-none p-6 shadow-2xl transition-all duration-500">
        <div className="space-y-4">
          <div className="glass-strong border-destructive/30 bg-destructive/10 -mx-6 -mt-6 mb-6 flex items-center gap-3 rounded-t-2xl border-b-2 p-6">
            <div className="bg-destructive/20 rounded-lg p-2">
              <AlertTriangle className="text-destructive h-5 w-5" />
            </div>
            <div>
              <h3 className="text-destructive text-sm font-bold tracking-wider uppercase">
                {t("settings.dangerZone", "Danger Zone")}
              </h3>
              <p className="text-destructive/70 text-xs font-medium">
                {t(
                  "settings.dangerZoneDesc",
                  "Irreversible actions. Please proceed with caution.",
                )}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-foreground text-sm font-semibold">
              {t("settings.clearDataTitle", "Clear All Data")}
            </h4>
            <p className="text-muted-foreground text-sm">
              {t(
                "settings.clearDataDesc",
                "This will permanently delete all data including files, folders, accounts, and settings. This action cannot be undone.",
              )}
            </p>
            <Button
              variant="destructive"
              onClick={() => setOpen(true)}
              className="w-full sm:w-auto"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("settings.clearDataButton", "Clear All Data")}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t("settings.confirmTitle", "Confirm Clear All Data")}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {t(
                "settings.confirmDesc",
                "Are you absolutely sure? This will permanently delete:",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
              <li>{t("settings.confirmItem1", "All files and folders")}</li>
              <li>{t("settings.confirmItem2", "All account information")}</li>
              <li>
                {t("settings.confirmItem3", "All settings and preferences")}
              </li>
              <li>
                {t("settings.confirmItem4", "All local database records")}
              </li>
            </ul>
            <p className="text-destructive pt-2 text-sm font-semibold">
              {t("settings.confirmWarning", "This action cannot be undone!")}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isClearing}
            >
              {t("settings.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirmClear}
              disabled={isClearing}
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
