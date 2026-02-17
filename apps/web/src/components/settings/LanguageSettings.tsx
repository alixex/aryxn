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
    <Card className="glass-premium hover:shadow-primary/5 border-none shadow-2xl transition-all duration-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {t("settings.languageSettings", "Language Settings")}
        </CardTitle>
        <CardDescription>
          {t(
            "settings.languageSettingsDesc",
            "Choose your preferred language for the interface",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
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
