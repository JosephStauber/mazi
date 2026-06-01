import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "flex h-11 w-full rounded-[var(--radius-md)] border bg-surface px-3.5 text-[15px] text-foreground transition-colors",
            "placeholder:text-subtle",
            "focus-visible:outline-none focus-visible:border-foreground focus-visible:ring-4 focus-visible:ring-foreground/5",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-danger" : "border-border",
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : hint ? (
          <p className="text-sm text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
