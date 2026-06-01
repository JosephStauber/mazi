"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme";
import { isNavActive } from "@/components/nav/nav-utils";
import {
  HomeIcon,
  SearchIcon,
  CommunitiesIcon,
  CreateIcon,
  BellIcon,
  SettingsIcon,
} from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import type { Profile } from "@/lib/types/database";

interface DesktopNavProps {
  user: Profile;
  unreadCount: number;
}

export function DesktopNav({ user, unreadCount }: DesktopNavProps) {
  const pathname = usePathname();

  const items: {
    href: string;
    label: string;
    icon: (active: boolean) => ReactNode;
    badge?: number;
  }[] = [
    { href: "/home", label: "Home", icon: (a) => <HomeIcon filled={a} size={24} /> },
    {
      href: "/search",
      label: "Search",
      icon: (a) => <SearchIcon filled={a} size={24} />,
    },
    {
      href: "/communities",
      label: "Communities",
      icon: (a) => <CommunitiesIcon filled={a} size={24} />,
    },
    {
      href: "/notifications",
      label: "Notifications",
      icon: (a) => <BellIcon filled={a} size={24} />,
      badge: unreadCount,
    },
    {
      href: "/compose",
      label: "Create",
      icon: (a) => <CreateIcon filled={a} size={24} />,
    },
  ];

  const profileHref = `/profile/${user.username}`;
  const profileActive = isNavActive(pathname, profileHref);

  return (
    <aside className="sticky top-0 z-50 hidden h-dvh w-[76px] shrink-0 flex-col border-r border-border bg-background/80 px-3 pb-4 pt-7 backdrop-blur-xl xl:w-[260px] md:flex">
      <Link
        href="/home"
        aria-label="Mazi home"
        className="mb-8 flex h-10 items-center px-2 xl:px-3"
      >
        <span className="brand hidden text-[1.75rem] xl:inline">
          mazi<span className="brand-dot">.</span>
        </span>
        <span className="brand text-[1.75rem] xl:hidden">
          m<span className="brand-dot">.</span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <NavLink
              key={item.href}
              href={item.href}
              active={active}
              label={item.label}
              badge={item.badge}
            >
              {item.icon(active)}
            </NavLink>
          );
        })}

        <NavLink href={profileHref} active={profileActive} label="Profile">
          <Avatar
            src={user.avatar_url}
            alt={user.username}
            size="xs"
            className={cn(
              "ring-offset-2 ring-offset-background",
              profileActive ? "ring-2 ring-foreground" : "ring-0"
            )}
          />
        </NavLink>

        <div className="flex-1" />

        <div className="flex items-center gap-1 px-1 xl:px-2">
          <NavLink href="/settings" active={isNavActive(pathname, "/settings")} label="Settings" muted>
            <SettingsIcon size={23} />
          </NavLink>
        </div>
        <div className="px-1 xl:px-2">
          <ThemeToggle />
        </div>
      </nav>
    </aside>
  );
}

function NavLink({
  href,
  active,
  label,
  badge,
  muted,
  children,
}: {
  href: string;
  active: boolean;
  label: string;
  badge?: number;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-4 rounded-[var(--radius-md)] px-3 py-2.5 transition-colors duration-150 touch-manipulation",
        active
          ? "bg-accent-muted font-semibold text-foreground"
          : muted
            ? "text-muted-foreground hover:bg-muted hover:text-foreground"
            : "text-foreground hover:bg-muted"
      )}
    >
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center transition-transform duration-150 ease-spring group-active:scale-90">
        {children}
        {badge != null && badge > 0 && (
          <span className="absolute -right-1.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground ring-2 ring-background">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className="hidden text-[15px] xl:inline">{label}</span>
    </Link>
  );
}
