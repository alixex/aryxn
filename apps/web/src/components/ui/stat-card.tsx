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
  variant = "purple",
}: StatCardProps) {
  const gradientClasses = {
    purple: "bg-gradient-primary",
    cyan: "from-cyan-500 to-blue-500 bg-gradient-to-br",
    gold: "from-amber-500 to-orange-500 bg-gradient-to-br",
  }

  const glowClasses = {
    purple: "glow-purple",
    cyan: "glow-cyan",
    gold: "glow-gold",
  }

  return (
    <Card
      className={cn(
        "group border-border/50 relative overflow-hidden backdrop-blur-sm transition-all duration-300",
        "hover:border-primary/30 hover:-translate-y-1 hover:shadow-2xl",
        "bg-card/80",
        className,
      )}
    >
      {/* Gradient overlay on hover */}
      <div className="from-primary/5 absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <CardContent className="relative flex items-center gap-4 p-6">
        {/* Icon with gradient background */}
        <div
          className={cn(
            gradientClasses[variant],
            glowClasses[variant],
            "flex-shrink-0 rounded-xl p-3.5 text-white shadow-lg transition-all duration-300",
            "group-hover:scale-110 group-hover:shadow-2xl",
          )}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground group-hover:text-foreground truncate text-sm font-medium transition-colors">
            {label}
          </p>
          <p className="text-foreground mt-1 truncate text-3xl font-bold transition-all duration-300 group-hover:scale-105">
            {value}
          </p>
          {trend && (
            <p
              className={cn(
                "mt-1 text-xs font-semibold transition-all duration-300",
                trendUp ? "text-emerald-400" : "text-rose-400",
                "group-hover:translate-x-1",
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
