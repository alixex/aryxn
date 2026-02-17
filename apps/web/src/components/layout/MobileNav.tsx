import { Link, useLocation } from "react-router-dom"
import { type LucideIcon } from "lucide-react"
import { useWallet } from "@/providers/wallet-provider"

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

interface MobileNavProps {
  items: NavItem[]
}

export function MobileNav({ items }: MobileNavProps) {
  const location = useLocation()
  const wallet = useWallet()
  const walletManager = wallet.internal
  const activeIndex = items.findIndex((item) => location.pathname === item.path)

  return (
    <nav className="pb-safe glass-strong border-border fixed right-0 bottom-0 left-0 z-40 border-t shadow-2xl md:hidden">
      <div className="relative flex h-16 items-center justify-around px-2">
        {/* Sliding indicator blob */}
        {activeIndex !== -1 && (
          <div
            className="bg-primary/10 cubic-bezier(0.16, 1, 0.3, 1) absolute top-2 bottom-2 z-0 rounded-2xl transition-all duration-500"
            style={{
              width: `calc(${100 / items.length}% - 8px)`,
              left: `calc(${activeIndex * (100 / items.length)}% + 4px)`,
            }}
          />
        )}

        {items.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          const isAccount = item.path === "/account"

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`touch-feedback relative z-10 flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-2 transition-all duration-300 ${
                isActive
                  ? "text-primary scale-105"
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              }`}
            >
              <div className="relative">
                <Icon
                  className={`h-5 w-5 transition-transform duration-300 ${
                    isActive ? "scale-110 rotate-[2deg]" : "scale-100"
                  }`}
                />
                {isAccount && walletManager.isUnlocked && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="bg-primary/40 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
                    <span className="bg-primary relative inline-flex h-2 w-2 rounded-full"></span>
                  </span>
                )}
              </div>
              <span className="sr-only text-[10px] font-bold tracking-wide uppercase">
                {item.label}
              </span>

              {/* Active dot indicator */}
              <div
                className={`bg-primary cubic-bezier(0.16, 1, 0.3, 1) mt-1 h-0.5 w-1 rounded-full transition-all duration-500 ${
                  isActive ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                }`}
              />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
