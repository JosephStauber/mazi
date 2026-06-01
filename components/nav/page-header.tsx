"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BackIcon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
  /** Sticks to the top of the scroll area. */
  sticky?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  back,
  action,
  sticky = true,
  className,
}: PageHeaderProps) {
  const router = useRouter();
  return (
    <div
      className={cn(
        "z-30 -mx-4 mb-1 flex items-center gap-2 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-xl sm:-mx-5 sm:px-5",
        sticky && "sticky top-14 md:top-0",
        className
      )}
    >
      {back && (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition-transform duration-150 ease-spring hover:bg-muted active:scale-90"
        >
          <BackIcon size={22} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="brand truncate text-[1.35rem] leading-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
