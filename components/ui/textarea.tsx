import { TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={cn(
            "flex min-h-[88px] w-full resize-none rounded-[var(--radius-md)] border bg-surface px-3.5 py-3 text-[15px] leading-relaxed text-foreground transition-colors",
            "placeholder:text-subtle",
            "focus-visible:outline-none focus-visible:border-foreground focus-visible:ring-4 focus-visible:ring-foreground/5",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-danger" : "border-border",
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
