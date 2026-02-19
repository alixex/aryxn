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
    <div className="flex flex-col gap-6 sm:min-h-31 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-3 sm:self-start">
        <h2 className="flex items-center gap-3 text-3xl font-extrabold tracking-tighter sm:text-4xl lg:text-5xl">
          <div
            className={cn(
              "rounded-xl p-2 text-white shadow-xl ring-1 ring-white/20 sm:rounded-2xl sm:p-2.5",
              iconContainerClassName,
            )}
          >
            {icon}
          </div>
          <span
            className={cn("bg-gradient-primary gradient-text leading-tight", titleClassName)}
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
