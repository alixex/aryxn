import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description: string
  icon: ReactNode
  rightSlot?: ReactNode
  iconContainerClassName?: string
  titleClassName?: string
}

export function PageHeader({
  title,
  description,
  icon,
  rightSlot,
  iconContainerClassName,
  titleClassName,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:min-h-28 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2.5 sm:self-start">
        <h2 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          <div
            className={cn(
              "bg-primary text-primary-foreground rounded-xl p-2 ring-1 ring-[hsl(var(--border)/0.8)] sm:rounded-2xl sm:p-2.5",
              iconContainerClassName,
            )}
          >
            {icon}
          </div>
          <span
            className={cn(
              "leading-tight text-[hsl(var(--foreground))]",
              titleClassName,
            )}
          >
            {title}
          </span>
        </h2>
        <p className="text-subtitle-muted max-w-lg text-base leading-relaxed font-medium">
          {description}
        </p>
      </div>

      {rightSlot ? <div className="sm:self-start">{rightSlot}</div> : null}
    </div>
  )
}
