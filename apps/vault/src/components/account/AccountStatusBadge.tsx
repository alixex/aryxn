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
    <div className="border-border/90 bg-card/84 flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 sm:w-64 sm:px-4">
      <div className="min-w-0 flex-1 sm:text-right">
        <div className="text-muted-foreground mb-0.5 text-[10px] leading-tight font-semibold tracking-wider uppercase">
          {label}
        </div>
        <div className="text-foreground truncate text-sm font-semibold">
          {value}
        </div>
      </div>

      {actionHref && actionIcon && (
        <Link to={actionHref} className="sm:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={actionAriaLabel}
          >
            {actionIcon}
          </Button>
        </Link>
      )}
    </div>
  )
}
