"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { springConfig } from "@/lib/motion";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[var(--elevation-1)] hover:shadow-[var(--elevation-2)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[var(--elevation-1)] hover:shadow-[var(--elevation-2)]",
        outline:
          "bg-transparent text-text-muted shadow-[var(--border-shadow)] hover:shadow-[var(--border-shadow-hover)] hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[var(--border-shadow)] hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground text-text-muted",
        link: "text-accent-blue underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "h-[34px] w-[34px] rounded-[7px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type MotionConflictingProps =
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragLeave"
  | "onDragOver"
  | "onDrop"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration";

export interface ButtonProps
  extends Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      MotionConflictingProps
    >,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();

    // For asChild (Slot), we can't use motion.button
    if (asChild) {
      return (
        <Slot
          className={cn(
            buttonVariants({ variant, size, className }),
            "transition-[box-shadow,background-color,color] duration-150"
          )}
          ref={ref}
          {...props}
        />
      );
    }

    return (
      <motion.button
        className={cn(
          buttonVariants({ variant, size, className }),
          "transition-[box-shadow,background-color,color] duration-150"
        )}
        ref={ref}
        whileHover={shouldReduceMotion ? undefined : { scale: 1.015 }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
        transition={springConfig.stiff}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
