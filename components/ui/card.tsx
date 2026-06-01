import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface CardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}

export function Card({ children, className, interactive }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-border bg-surface",
        interactive &&
          "transition-all duration-200 hover:border-border-strong hover:shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
