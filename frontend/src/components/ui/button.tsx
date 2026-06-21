import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
          {
            "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:shadow-md hover:shadow-primary/20":
              variant === "default",
            "bg-secondary text-secondary-foreground hover:bg-secondary/70 shadow-sm":
              variant === "secondary",
            "border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm border-transition":
              variant === "outline",
            "hover:bg-muted text-muted-foreground hover:text-foreground":
              variant === "ghost",
            "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md":
              variant === "destructive",
          },
          {
            "h-10 md:h-9 px-4 py-2 rounded-lg": size === "default",
            "h-9 md:h-8 rounded-lg px-3 text-xs": size === "sm",
            "h-11 rounded-lg px-8": size === "lg",
            "h-10 w-10 md:h-9 md:w-9 rounded-lg": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
