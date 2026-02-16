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

  return (
    <nav className="pb-safe glass-strong border-border fixed right-0 bottom-0 left-0 z-40 border-t shadow-2xl md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          const isAccount = item.path === "/account"

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`touch-feedback flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-2 transition-all duration-200 ${
                isActive
                  ? "bg-accent text-accent-foreground scale-105"
                  : "text-muted-foreground active:scale-95"
              }`}
            >
              <div className="relative">
                <Icon
                  className={`h-5 w-5 ${isActive ? "scale-110" : "scale-100"}`}
                />
                {isAccount && walletManager.isUnlocked && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="bg-primary/40 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
                    <span className="bg-primary relative inline-flex h-2 w-2 rounded-full"></span>
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold tracking-wide uppercase">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
