"use client";

import { useRef } from "react";
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
  const tabRefs = useRef<(HTMLElement | null)[]>([]);

  const isActive = (item: TabItem) =>
    item.href ? activeHref === item.href : activeValue === item.value;

  const activeIndex = items.findIndex(isActive);
  // When nothing is active yet, keep the first tab in the tab order so the
  // tablist stays keyboard-reachable (roving tabindex).
  const focusIndex = activeIndex >= 0 ? activeIndex : 0;

  // WAI-ARIA tablist keyboard nav (manual activation): arrows move focus between
  // tabs; the user activates with Enter/Space (button) or Enter (link).
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    tabRefs.current[next]?.focus();
  }

  return (
    <div
      className={cn(
        "flex w-full items-stretch border-b border-border",
        className
      )}
      role="tablist"
    >
      {items.map((item, i) => {
        const active = isActive(item);

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
          <Link
            key={item.href}
            href={item.href}
            className={classes}
            role="tab"
            aria-selected={active}
            tabIndex={i === focusIndex ? 0 : -1}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {inner}
          </Link>
        ) : (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={i === focusIndex ? 0 : -1}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
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
