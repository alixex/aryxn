import { Globe } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useTranslation } from "@/i18n/config"

export default function LanguageSettings() {
  const { t } = useTranslation()

  return (
    <Card className="border-border/90 bg-card/84 border shadow-[0_16px_30px_-20px_hsl(220_35%_2%/0.72)] transition-all duration-200">
      <CardHeader className="animate-fade-in-down border-border/85 bg-card/92 rounded-t-2xl border-b p-5 sm:p-6">
        <CardTitle className="text-foreground flex items-center gap-3 text-base font-semibold">
          <div className="bg-muted text-foreground rounded-lg p-2">
            <Globe className="h-5 w-5" />
          </div>
          {t("settings.languageSettings", "Language Settings")}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-xs font-medium">
          {t(
            "settings.languageSettingsDesc",
            "Choose your preferred language for the interface",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-foreground text-sm font-semibold">
              {t("settings.language", "Language")}
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {t(
                "settings.languageDesc",
                "Select the language for the user interface",
              )}
            </p>
          </div>
          <LanguageSwitcher />
        </div>
      </CardContent>
    </Card>
  )
}
