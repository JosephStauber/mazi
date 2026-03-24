"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { isNavActive } from "@/components/nav/nav-utils";
import type { Profile } from "@/lib/types/database";

interface DesktopNavProps {
  user: Profile;
  unreadCount: number;
}

export function DesktopNav({ user, unreadCount }: DesktopNavProps) {
  const pathname = usePathname();

  const railItems: {
    href: string;
    label: string;
    icon: (active: boolean) => ReactNode;
  }[] = [
    {
      href: "/home",
      label: "Home",
      icon: (a) => <HomeIcon active={a} />,
    },
    {
      href: "/communities",
      label: "Communities",
      icon: (a) => <PeopleIcon active={a} />,
    },
    {
      href: "/compose",
      label: "Create",
      icon: (a) => <CreateIcon active={a} />,
    },
    {
      href: "/search",
      label: "Search",
      icon: (a) => <SearchIcon active={a} />,
    },
  ];

  return (
    <aside className="sticky top-0 z-50 hidden h-dvh w-[72px] shrink-0 flex-col border-r border-border bg-background px-2 pb-4 pt-6 xl:w-[244px] md:flex">
      <Link
        href="/home"
        aria-label="Mazi home"
        className="mb-8 flex justify-center px-2 xl:justify-start xl:px-4"
      >
        <span className="hidden text-xl font-semibold tracking-tight xl:inline">
          Mazi
        </span>
        <span className="text-xl font-bold tracking-tighter xl:hidden">M</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5">
        {railItems.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-4 rounded-lg py-3 pl-3 pr-2 transition-colors touch-manipulation xl:pr-4 ${
                active
                  ? "font-semibold text-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                {item.icon(active)}
              </span>
              <span className="hidden xl:inline">{item.label}</span>
            </Link>
          );
        })}

        <Link
          href={`/profile/${user.username}`}
          className={`mt-1 flex items-center gap-4 rounded-lg py-3 pl-3 pr-2 transition-colors touch-manipulation xl:pr-4 ${
            isNavActive(pathname, `/profile/${user.username}`)
              ? "font-semibold text-foreground"
              : "text-foreground hover:bg-muted"
          }`}
        >
          <Avatar
            src={user.avatar_url}
            alt={user.username}
            size="sm"
            className={`shrink-0 ring-2 ring-offset-2 ring-offset-background ${
              isNavActive(pathname, `/profile/${user.username}`)
                ? "ring-foreground"
                : "ring-transparent"
            }`}
          />
          <span className="hidden xl:inline">Profile</span>
        </Link>

        <div className="flex-1 min-h-4" />

        <Link
          href="/notifications"
          className={`relative flex items-center gap-4 rounded-lg py-3 pl-3 pr-2 transition-colors touch-manipulation xl:pr-4 ${
            isNavActive(pathname, "/notifications")
              ? "font-semibold text-foreground"
              : "text-foreground hover:bg-muted"
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center">
            <HeartIcon active={isNavActive(pathname, "/notifications")} />
          </span>
          <span className="hidden xl:inline">Notifications</span>
          {unreadCount > 0 ? (
            <span className="absolute left-7 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white xl:left-9">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Link>

        <Link
          href="/settings"
          className="flex items-center gap-4 rounded-lg py-3 pl-3 pr-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground xl:pr-4"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center">
            <SettingsIcon />
          </span>
          <span className="hidden xl:inline">Settings</span>
        </Link>
      </nav>
    </aside>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return active ? (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z" />
    </svg>
  ) : (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function SearchIcon({ active }: { active: boolean }) {
  return active ? (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.75" fill="none" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  ) : (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PeopleIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CreateIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function HeartIcon({ active }: { active: boolean }) {
  return active ? (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ) : (
    <svg
      width="26"
      height="26"
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

function SettingsIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}
