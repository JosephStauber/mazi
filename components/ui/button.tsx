import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "default" | "outline" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
}

const variantStyles: Record<Variant, string> = {
  default:
    "bg-foreground text-background hover:opacity-90 active:opacity-100 shadow-xs",
  outline:
    "border border-border-strong bg-transparent text-foreground hover:bg-muted",
  ghost: "bg-transparent text-foreground hover:bg-muted",
  subtle: "bg-muted text-foreground hover:bg-border",
  danger: "bg-danger text-danger-foreground hover:opacity-90 shadow-xs",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-8 px-3.5 text-sm gap-1.5 rounded-[var(--radius-sm)]",
  md: "h-10 px-4 text-sm gap-2 rounded-[var(--radius-md)]",
  lg: "h-12 px-6 text-base gap-2 rounded-[var(--radius-md)]",
};

/**
 * Shared button styling so a link that should look like a button can be a single
 * interactive `<a>` (no invalid `<a><button>` nesting).
 */
export function buttonClassName({
  variant = "default",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(
    "relative inline-flex items-center justify-center font-medium transition-all duration-150 ease-spring select-none touch-manipulation",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    variantStyles[variant],
    sizeStyles[size],
    fullWidth && "w-full",
    className
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "default",
      size = "md",
      loading = false,
      fullWidth = false,
      leftIcon,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={buttonClassName({ variant, size, fullWidth, className })}
        {...props}
      >
        {loading && (
          <span className="absolute inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        <span
          className={cn(
            "inline-flex items-center justify-center gap-2",
            loading && "opacity-0"
          )}
        >
          {leftIcon}
          {children}
        </span>
      </button>
    );
  }
);

Button.displayName = "Button";
