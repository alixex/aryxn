import { useState } from "react"
import { Link } from "react-router-dom"
import {
  LayoutDashboard,
  Upload,
  UserCircle,
  Search,
  Settings,
} from "lucide-react"
import { useTranslation } from "@/i18n/config"
import { LanguageSwitcher } from "@/components/language-switcher"
import { NavLogo } from "./NavLogo"
import { DesktopNav } from "./DesktopNav"
import { AccountButton } from "./AccountButton"
import { MobileNav } from "./MobileNav"
import { NavDivider } from "./NavDivider"
import { ArweaveSearch } from "./ArweaveSearch"
import { MobileSearchDialog } from "./MobileSearchDialog"
import { Button } from "@/components/ui/button"

export function Navbar() {
  const { t } = useTranslation()
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const navItems = [
    { path: "/", label: t("common.upload"), icon: Upload },
    { path: "/dashboard", label: t("common.dashboard"), icon: LayoutDashboard },
    {
      path: "/settings",
      label: t("common.settings", "Settings"),
      icon: Settings,
    },
    { path: "/account", label: t("common.account"), icon: UserCircle },
  ]

  // Desktop nav items (exclude account/settings because settings has its own icon button).
  const desktopNavItems = navItems.filter(
    (item) => item.path !== "/account" && item.path !== "/settings",
  )

  return (
    <>
      <header className="glass-strong border-border/80 fixed top-0 right-0 left-0 z-40 border-b shadow-[0_14px_28px_-18px_hsl(220_40%_2%/0.72)] backdrop-blur-xl transition-shadow duration-300">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 lg:px-8">
          {/* Left section: logo + search */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            <NavLogo />
            {/* Search input (large screens) */}
            <div className="hidden max-w-md min-w-50 flex-1 lg:block">
              <ArweaveSearch />
            </div>
          </div>

          {/* Right section: search trigger + nav + language switcher + account */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
            {/* Search button for mobile and medium screens */}
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-primary/15 hover:text-primary lg:hidden"
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Desktop navigation items (upload, dashboard) */}
            <DesktopNav items={desktopNavItems} />

            {/* Divider between nav and language switcher */}
            <NavDivider className="bg-border/20 mx-1 hidden h-8 w-px lg:block" />

            {/* Language switcher (hidden on mobile because bottom nav exists) */}
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>

            {/* Divider between language switcher and settings button */}
            <NavDivider className="bg-border/20 mx-1 hidden h-8 w-px md:block" />

            {/* Settings button */}
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="hover:bg-primary/15 hover:text-primary hidden md:flex"
              aria-label={t("common.settings", "Settings")}
            >
              <Link to="/settings">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>

            {/* Divider between settings and account button */}
            <NavDivider className="bg-border/20 mx-1 hidden h-8 w-px md:block" />

            {/* Account button */}
            <AccountButton />
          </div>
        </div>
      </header>
      <div className="h-16" aria-hidden="true" />

      {/* Mobile search dialog */}
      <MobileSearchDialog
        open={mobileSearchOpen}
        onOpenChange={setMobileSearchOpen}
      />

      {/* Mobile bottom navigation */}
      <MobileNav items={navItems} />
    </>
  )
}
