"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { isNavActive } from "@/components/nav/nav-utils";
import {
  HomeIcon,
  SearchIcon,
  CommunitiesIcon,
  PlusIcon,
} from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/85 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(0.3rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex h-14 items-center justify-around px-2">
        <Item href="/home" label="Home" active={isNavActive(pathname, "/home")}>
          {(a) => <HomeIcon filled={a} size={25} />}
        </Item>
        <Item
          href="/communities"
          label="Communities"
          active={isNavActive(pathname, "/communities")}
        >
          {(a) => <CommunitiesIcon filled={a} size={25} />}
        </Item>

        <Link
          href="/compose"
          aria-label="Create post"
          className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-foreground text-background shadow-sm transition-transform duration-150 ease-spring active:scale-90"
        >
          <PlusIcon size={24} />
        </Link>

        <Item
          href="/search"
          label="Search"
          active={isNavActive(pathname, "/search")}
        >
          {(a) => <SearchIcon filled={a} size={25} />}
        </Item>

        <Link
          href={profileHref}
          aria-label={`Profile (${username})`}
          className="flex min-h-11 min-w-11 items-center justify-center touch-manipulation transition-transform duration-150 ease-spring active:scale-90"
        >
          <Avatar
            src={avatarUrl}
            alt={username}
            size="xs"
            className={cn(
              "ring-offset-2 ring-offset-background",
              profileActive ? "ring-2 ring-foreground" : "ring-0"
            )}
          />
        </Link>
      </div>
    </nav>
  );
}

function Item({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: (active: boolean) => React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "flex min-h-11 min-w-11 items-center justify-center touch-manipulation transition-transform duration-150 ease-spring active:scale-90",
        active ? "text-foreground" : "text-subtle"
      )}
    >
      {children(active)}
    </Link>
  );
}
