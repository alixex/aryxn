import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-primary text-primary-foreground shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.55)] hover:-translate-y-0.5 hover:shadow-[0_14px_26px_-16px_hsl(var(--primary)/0.45)] active:translate-y-0",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_10px_20px_-16px_hsl(var(--destructive)/0.55)] hover:-translate-y-0.5 hover:shadow-[0_14px_24px_-16px_hsl(var(--destructive)/0.5)] active:translate-y-0",
        outline:
          "border border-[hsl(var(--border)/0.95)] bg-[hsl(var(--card)/0.72)] text-foreground hover:bg-[hsl(var(--accent)/0.75)] hover:border-[hsl(var(--foreground)/0.24)]",
        secondary:
          "bg-secondary/88 text-secondary-foreground hover:bg-secondary transition-colors",
        ghost:
          "text-foreground hover:bg-accent/45 transition-colors",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80 transition-colors",
        gradient:
          "bg-gradient-secondary text-secondary-foreground shadow-[0_10px_24px_-16px_hsl(var(--secondary)/0.5)] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-18px_hsl(var(--secondary)/0.42)] active:translate-y-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
