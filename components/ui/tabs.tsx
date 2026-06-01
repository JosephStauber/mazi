"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface TabItem {
  label: string;
  href?: string;
  value?: string;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  /** For link-based tabs: the currently active href. */
  activeHref?: string;
  /** For state-based tabs: the active value + change handler. */
  activeValue?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function Tabs({
  items,
  activeHref,
  activeValue,
  onChange,
  className,
}: TabsProps) {
  return (
    <div
      className={cn(
        "flex w-full items-stretch border-b border-border",
        className
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.href
          ? activeHref === item.href
          : activeValue === item.value;

        const inner = (
          <span className="relative flex items-center justify-center gap-1.5 px-1 pb-3 pt-1">
            {item.label}
            {typeof item.count === "number" && (
              <span className="text-xs text-subtle">{item.count}</span>
            )}
            <span
              className={cn(
                "absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-foreground transition-transform duration-200 ease-spring",
                active ? "scale-x-100" : "scale-x-0"
              )}
            />
          </span>
        );

        const classes = cn(
          "flex-1 text-center text-sm font-semibold transition-colors",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        );

        return item.href ? (
          <Link key={item.href} href={item.href} className={classes} role="tab">
            {inner}
          </Link>
        ) : (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => item.value && onChange?.(item.value)}
            className={classes}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
