import { Link } from "react-router-dom"
import { HardDrive } from "lucide-react"
import { useTranslation } from "@/i18n/config"

export function NavLogo() {
  const { t } = useTranslation()

  return (
    <Link to="/" className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <HardDrive className="text-foreground h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8" />
      <h1 className="text-foreground text-base font-bold tracking-tight sm:text-lg lg:text-xl">
        {t("common.appName")}
      </h1>
    </Link>
  )
}
