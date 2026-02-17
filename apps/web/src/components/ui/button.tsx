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
          "bg-gradient-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] glow-purple",
        destructive:
          "bg-destructive text-destructive-foreground shadow-lg hover:shadow-xl active:scale-[0.98] glow-red",
        outline:
          "border-2 border-primary/50 bg-transparent hover:bg-primary/10 hover:border-primary text-primary active:scale-[0.98] backdrop-blur-sm",
        secondary:
          "bg-secondary/80 text-secondary-foreground hover:bg-secondary/100 active:scale-[0.98] transition-colors",
        ghost:
          "hover:bg-accent/50 text-foreground active:scale-[0.95] transition-colors",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80 transition-colors",
        gradient:
          "bg-gradient-secondary text-primary-foreground shadow-lg hover:shadow-xl active:scale-[0.98] glow-gold",
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
