"use client";

import Link from "next/link";

interface MobileHeaderProps {
  unreadCount: number;
}

export function MobileHeader({ unreadCount }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-11 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:hidden">
      <Link
        href="/home"
        className="text-lg font-semibold tracking-tight text-foreground"
      >
        Mazi
      </Link>
      <Link
        href="/notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-md text-foreground touch-manipulation active:opacity-70"
        aria-label="Notifications"
      >
        <HeartIcon />
        {unreadCount > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Link>
    </header>
  );
}

function HeartIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
