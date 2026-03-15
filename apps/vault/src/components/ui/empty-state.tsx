import type { ReactNode } from "react"

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center sm:py-12">
      <div className="bg-muted text-foreground ring-border mb-3 rounded-full p-4 ring-1 sm:mb-4 sm:p-6 [&>svg]:h-8 [&>svg]:w-8 sm:[&>svg]:h-10 sm:[&>svg]:w-10">
        {icon}
      </div>
      <h3 className="text-foreground mb-2 text-lg font-semibold">{title}</h3>
      {description && (
        <p className="text-muted-foreground mb-6 max-w-md text-sm">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
