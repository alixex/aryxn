import { type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

interface AccountStatusBadgeProps {
  label: string
  value: string
  actionHref?: string
  actionAriaLabel?: string
  actionIcon?: ReactNode
}

export function AccountStatusBadge({
  label,
  value,
  actionHref,
  actionAriaLabel,
  actionIcon,
}: AccountStatusBadgeProps) {
  return (
    <div className="glass-premium hover:shadow-primary/5 flex min-h-14 w-full items-center gap-3 border-none p-3 shadow-2xl transition-all duration-500 sm:w-56 sm:px-4 sm:py-2">
      <div className="min-w-0 flex-1 sm:text-right">
        <div className="text-muted-foreground mb-0.5 text-[10px] leading-tight font-bold tracking-wider uppercase">
          {label}
        </div>
        <div className="text-foreground truncate text-sm font-bold">
          {value}
        </div>
      </div>

      {actionHref && actionIcon && (
        <Link to={actionHref} className="sm:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:text-cyan-400"
            aria-label={actionAriaLabel}
          >
            {actionIcon}
          </Button>
        </Link>
      )}
    </div>
  )
}
