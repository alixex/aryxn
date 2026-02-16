import { Link, useLocation } from "react-router-dom"
import { type LucideIcon } from "lucide-react"

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

interface DesktopNavProps {
  items: NavItem[]
}

export function DesktopNav({ items }: DesktopNavProps) {
  const location = useLocation()

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = location.pathname === item.path

        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex cursor-pointer items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
