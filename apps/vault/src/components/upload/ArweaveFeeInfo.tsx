import { ExternalLink, Calculator } from "lucide-react"
import { useTranslation } from "@/i18n/config"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ArweaveFeeInfo() {
  const { t } = useTranslation()

  return (
    <Card className="glass-premium hover:shadow-primary/5 border-none shadow-2xl transition-all duration-500">
      <CardHeader className="sm:pb-4">
        <div className="flex items-center gap-2">
          <div className="bg-secondary text-foreground rounded-lg p-1.5">
            <Calculator className="h-4 w-4" />
          </div>
          <CardTitle className="text-base sm:text-lg">
            {t("upload.feeInfoTitle")}
          </CardTitle>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          {t("upload.feeInfoDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-border bg-background rounded-lg border p-4">
          <p className="text-foreground mb-3 text-sm font-semibold">
            {t("upload.feeInfoNote")}
          </p>
          <ul className="text-muted-foreground space-y-2 text-xs leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-foreground/50 mt-0.5 shrink-0">•</span>
              <span>{t("upload.feeInfoItem1")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-foreground/50 mt-0.5 shrink-0">•</span>
              <span>{t("upload.feeInfoItem2")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-foreground/50 mt-0.5 shrink-0">•</span>
              <span>{t("upload.feeInfoItem3")}</span>
            </li>
          </ul>
        </div>
        <a
          href="https://ar-fees.arweave.net/"
          target="_blank"
          rel="noopener noreferrer"
          className="border-border bg-secondary text-foreground hover:bg-accent flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors"
        >
          <span>{t("upload.viewFeeCalculator")}</span>
          <ExternalLink className="h-4 w-4" />
        </a>
      </CardContent>
    </Card>
  )
}
