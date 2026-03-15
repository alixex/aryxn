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
    <nav className="hidden items-center gap-1.5 rounded-full border border-[hsl(var(--border)/0.92)] bg-[hsl(var(--card)/0.82)] p-1 md:flex">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = location.pathname === item.path

        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-[hsl(var(--accent)/0.62)] hover:text-foreground"
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
