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
      <CardHeader className="glass-strong animate-fade-in-down border-accent/30 bg-card/60 rounded-t-2xl border-b-2 p-6 shadow-lg">
        <CardTitle className="text-foreground flex items-center gap-3 text-base font-bold">
          <div className="rounded-lg bg-[hsl(var(--secondary)/0.2)] p-2 text-[hsl(var(--secondary))]">
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
