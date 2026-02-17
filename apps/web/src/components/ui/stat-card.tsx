import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string | number
  trend?: string
  trendUp?: boolean
  className?: string
}

export function StatCard({
  icon,
  label,
  value,
  trend,
  trendUp,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("border-border overflow-hidden", className)}>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="bg-gradient-primary glow-purple flex-shrink-0 rounded-lg p-3 text-white shadow-lg">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground truncate text-sm">{label}</p>
          <p className="text-foreground truncate text-2xl font-bold">{value}</p>
          {trend && (
            <p
              className={cn(
                "text-xs font-medium",
                trendUp ? "text-green-500" : "text-red-500",
              )}
            >
              {trend}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
