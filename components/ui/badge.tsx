import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "default" | "outline" | "solid";

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  const variants: Record<Variant, string> = {
    default: "bg-muted text-muted-foreground",
    outline: "border border-border text-muted-foreground",
    solid: "bg-foreground text-background",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
