import { useState } from "react"
import { Link } from "react-router-dom"
import {
  LayoutDashboard,
  Upload,
  UserCircle,
  Search,
  Settings,
  Zap,
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
    { path: "/dex", label: t("common.dex"), icon: Zap },
    { path: "/dashboard", label: t("common.dashboard"), icon: LayoutDashboard },
    {
      path: "/settings",
      label: t("common.settings", "Settings"),
      icon: Settings,
    },
    { path: "/account", label: t("common.account"), icon: UserCircle },
  ]

  // 桌面端显示的导航项（排除账户管理和设置，因为设置有单独的图标按钮）
  const desktopNavItems = navItems.filter(
    (item) => item.path !== "/account" && item.path !== "/settings",
  )

  return (
    <>
      <header className="border-border bg-background/80 sticky top-0 z-40 border-b shadow-sm backdrop-blur-xl transition-shadow duration-300">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 lg:px-8">
          {/* 左侧：Logo + 搜索框 */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            <NavLogo />
            {/* 搜索框（大屏幕显示） */}
            <div className="hidden max-w-md min-w-[200px] flex-1 lg:block">
              <ArweaveSearch />
            </div>
          </div>

          {/* 右侧：搜索按钮（移动端/中等屏幕） + 导航项 + 语言切换器 + 账户按钮 */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
            {/* 移动端和中等屏幕的搜索按钮 */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* 桌面端导航项（上传、数据管理） */}
            <DesktopNav items={desktopNavItems} />

            {/* 分隔线（导航项和语言切换器之间） */}
            <NavDivider className="bg-border mx-1 hidden h-8 w-px lg:block" />

            {/* 语言切换器（移动端隐藏，因为底部导航已有） */}
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>

            {/* 分隔线（语言切换器和设置按钮之间） */}
            <NavDivider className="bg-border mx-1 hidden h-8 w-px md:block" />

            {/* 设置按钮 */}
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="hidden md:flex"
              aria-label={t("common.settings", "Settings")}
            >
              <Link to="/settings">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>

            {/* 分隔线（设置按钮和账户按钮之间） */}
            <NavDivider className="bg-border mx-1 hidden h-8 w-px md:block" />

            {/* 账户按钮 */}
            <AccountButton />
          </div>
        </div>
      </header>

      {/* 移动端搜索对话框 */}
      <MobileSearchDialog
        open={mobileSearchOpen}
        onOpenChange={setMobileSearchOpen}
      />

      {/* 移动端底部导航 */}
      <MobileNav items={navItems} />
    </>
  )
}
