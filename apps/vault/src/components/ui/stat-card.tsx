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
  variant?: "purple" | "cyan" | "gold"
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
    <Card
      className={cn(
        "group border-border/90 bg-card/88 relative overflow-hidden border transition-all duration-200",
        "hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-[0_16px_28px_-20px_hsl(220_35%_3%/0.72)]",
        className,
      )}
    >
      <CardContent className="relative flex items-center gap-4 p-6">
        <div
          className={cn(
            "bg-primary text-primary-foreground",
            "shrink-0 rounded-xl p-3 transition-all duration-200",
            "group-hover:scale-105",
          )}
        >
          <div className="transition-transform duration-200">
            {icon}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
            {label}
          </p>
          <p className="text-foreground mt-0.5 truncate text-3xl font-semibold tracking-tight">
            {value}
          </p>
          {trend && (
            <p
              className={cn(
                "mt-1.5 flex items-center gap-1 text-xs font-semibold",
                trendUp ? "text-[hsl(165_55%_52%)]" : "text-[hsl(6_70%_62%)]",
              )}
            >
              <span
                className={cn(
                  "h-1 w-1 rounded-full",
                  trendUp ? "bg-[hsl(165_65%_35%)]" : "bg-[hsl(6_60%_46%)]",
                )}
              />
              {trend}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
