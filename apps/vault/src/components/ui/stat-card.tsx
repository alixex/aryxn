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
        "glass-premium group relative overflow-hidden transition-all duration-500",
        "hover:border-primary/40 hover:-translate-y-1.5 hover:shadow-2xl",
        "after:absolute after:inset-0 after:z-10 after:translate-x-[-150%] after:bg-linear-to-r after:from-transparent after:via-[hsl(var(--accent)/0.18)] after:to-transparent after:transition-transform after:duration-900 hover:after:translate-x-[150%]",
        className,
      )}
    >
      <CardContent className="relative flex items-center gap-4 p-6">
        <div
          className={cn(
            "bg-gradient-primary",
            "shrink-0 rounded-xl p-3.5 text-white shadow-lg transition-all duration-500",
            "group-hover:scale-110 group-hover:shadow-[0_16px_28px_-14px_hsl(var(--primary)/0.8)]",
          )}
        >
          <div className="transition-transform duration-500 group-hover:rotate-12">
            {icon}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground group-hover:text-foreground text-xs font-bold tracking-widest uppercase transition-colors duration-300">
            {label}
          </p>
          <p className="text-foreground mt-0.5 truncate text-3xl font-extrabold tracking-tight transition-all duration-500 group-hover:scale-[1.02]">
            {value}
          </p>
          {trend && (
            <p
              className={cn(
                "mt-1.5 text-xs font-bold transition-all duration-500",
                trendUp ? "text-[hsl(165_65%_35%)]" : "text-[hsl(6_60%_46%)]",
                "flex items-center gap-1 group-hover:translate-x-1",
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
