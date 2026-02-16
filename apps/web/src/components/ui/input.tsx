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
          "bg-background flex h-10 w-full rounded-lg border-2 px-3 py-2 text-base transition-all duration-200 md:text-sm",
          "placeholder:text-muted-foreground",
          "file:text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "focus:border-ring focus:ring-ring/10 focus:ring-4 focus:outline-none",
          "disabled:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
          error &&
            "border-destructive focus:border-destructive focus:ring-destructive/10",
          success &&
            "border-foreground/50 focus:border-foreground focus:ring-foreground/10",
          !error && !success && "border-border",
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
