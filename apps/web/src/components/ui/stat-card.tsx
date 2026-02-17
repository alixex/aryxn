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
        "after:absolute after:inset-0 after:z-10 after:translate-x-[-150%] after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent after:transition-transform after:duration-[800ms] hover:after:translate-x-[150%]",
        className,
      )}
    >
      <CardContent className="relative flex items-center gap-4 p-6">
        {/* Icon with refined styling */}
        <div
          className={cn(
            "bg-gradient-primary glow-purple",
            "flex-shrink-0 rounded-xl p-3.5 text-white shadow-lg transition-all duration-500",
            "group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(157,78,221,0.6)]",
          )}
        >
          <div className="transition-transform duration-500 group-hover:rotate-12">
            {icon}
          </div>
        </div>

        {/* Content with smoother typography */}
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
                trendUp ? "text-emerald-400" : "text-rose-400",
                "flex items-center gap-1 group-hover:translate-x-1",
              )}
            >
              <span
                className={cn(
                  "h-1 w-1 rounded-full",
                  trendUp ? "bg-emerald-400" : "bg-rose-400",
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
