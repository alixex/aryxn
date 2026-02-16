import { Link } from "react-router-dom"
import { useTranslation } from "@/i18n/config"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowRight } from "lucide-react"

interface UploadWarningProps {
  isLocked: boolean
  hasExternalWallet: boolean
}

export function UploadWarning({
  isLocked,
  hasExternalWallet,
}: UploadWarningProps) {
  const { t } = useTranslation()

  if (isLocked && !hasExternalWallet) {
    return (
      <div className="border-muted bg-card flex items-start gap-4 rounded-xl border-2 p-5 text-sm shadow-lg">
        <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <AlertCircle className="text-muted-foreground h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-foreground mb-2 text-base leading-relaxed font-bold">
            {t("upload.needUnlockToUpload")}
          </p>
          <p className="text-muted-foreground mb-3 text-sm leading-relaxed">
            {t("upload.unlockHint")}
          </p>
          <Link to="/account">
            <Button
              variant="outline"
              className="border-border bg-background text-foreground hover:bg-accent rounded-lg font-semibold"
            >
              {t("upload.goToAccount")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return null
}
