import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  error?: boolean
  success?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, success, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "bg-card/40 flex h-10 w-full rounded-lg border-2 px-4 py-2 text-base backdrop-blur-sm transition-all duration-200 md:text-sm",
          "placeholder:text-muted-foreground/60",
          "file:text-foreground file:border-0 file:bg-transparent file:text-sm file:font-semibold",
          "focus:border-primary focus:ring-primary/20 focus:bg-card/60 focus:ring-4 focus:outline-none",
          "disabled:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50",
          "hover:border-primary/30 hover:bg-card/50 transition-colors",
          error &&
            "border-destructive focus:border-destructive focus:ring-destructive/20",
          success &&
            "border-secondary focus:border-secondary focus:ring-secondary/20",
          !error && !success && "border-border/50",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = "Input"

export { Input }
