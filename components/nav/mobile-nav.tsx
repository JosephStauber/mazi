"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { isNavActive } from "@/components/nav/nav-utils";

interface MobileNavProps {
  username: string;
  avatarUrl: string | null;
}

export function MobileNav({ username, avatarUrl }: MobileNavProps) {
  const pathname = usePathname();
  const profileHref = `/profile/${username}`;
  const profileActive = isNavActive(pathname, profileHref);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden"
      style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
    >
      <div className="relative flex h-14 items-center justify-between px-2">
        <div className="flex flex-1 justify-around">
          <MobileNavItem
            href="/home"
            label="Home"
            icon={(a) => <HomeIcon active={a} />}
            active={isNavActive(pathname, "/home")}
          />
          <MobileNavItem
            href="/communities"
            label="Communities"
            icon={(a) => <PeopleIcon active={a} />}
            active={isNavActive(pathname, "/communities")}
          />
        </div>

        <div className="relative flex w-[4.5rem] shrink-0 justify-center">
          <Link
            href="/compose"
            className={`absolute -top-5 flex h-14 w-14 items-center justify-center rounded-full border-4 border-background bg-foreground text-background shadow-md transition-transform touch-manipulation active:scale-95 ${
              isNavActive(pathname, "/compose")
                ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                : ""
            }`}
            aria-label="Create post"
          >
            <PlusIcon />
          </Link>
        </div>

        <div className="flex flex-1 justify-around">
          <MobileNavItem
            href="/search"
            label="Search"
            icon={(a) => <SearchIcon active={a} />}
            active={isNavActive(pathname, "/search")}
          />
          <Link
            href={profileHref}
            className={`relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 touch-manipulation ${
              profileActive ? "text-foreground" : "text-muted-foreground"
            }`}
            aria-label={`Profile (${username})`}
          >
            <Avatar
              src={avatarUrl}
              alt={username}
              size="sm"
              className={
                profileActive
                  ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  : ""
              }
            />
          </Link>
        </div>
      </div>
    </nav>
  );
}

function MobileNavItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 text-[10px] font-medium touch-manipulation ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      <span className="flex h-7 w-7 items-center justify-center">
        {icon(active)}
      </span>
      <span className="sr-only">{label}</span>
    </Link>
  );
}

function PlusIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return active ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z" />
    </svg>
  ) : (
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
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function PeopleIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
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

function SearchIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
