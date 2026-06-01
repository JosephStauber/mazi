"use client";

import Link from "next/link";
import { BellIcon } from "@/components/ui/icon";
import { ThemeToggle } from "@/components/ui/theme";

interface MobileHeaderProps {
  unreadCount: number;
}

export function MobileHeader({ unreadCount }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-xl md:hidden">
      <Link href="/home" className="brand text-[1.6rem] text-foreground">
        mazi<span className="brand-dot">.</span>
      </Link>
      <div className="flex items-center">
        <ThemeToggle />
        <Link
          href="/notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-transform duration-150 ease-spring touch-manipulation active:scale-90"
          aria-label="Notifications"
        >
          <BellIcon size={23} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground ring-2 ring-background">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
