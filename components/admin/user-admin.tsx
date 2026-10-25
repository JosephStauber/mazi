"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Segmented } from "@/components/admin/segmented";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { formatJoinDate, formatRelative } from "@/lib/utils/date";

export type AdminUser = FunctionReturnType<typeof api.admin.searchUsers>[number];
type Filter = "all" | "new" | "suspended";

export function UserBadges({ user }: { user: AdminUser }) {
  return (
    <>
      {user.admin_role && <Badge variant="solid">{user.admin_role}</Badge>}
      {user.access_level === "reserved" && <Badge variant="outline">reserved</Badge>}
      {user.suspended_at && (
        <Badge className="bg-danger text-danger-foreground">suspended</Badge>
      )}
      {user.flagged && (
        <Badge className="bg-accent-muted text-accent">new &amp; very active</Badge>
      )}
    </>
  );
}

export function UserAdmin() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const term = useDeferredValue(search.trim());

  // Live: a suspension made by another admin shows up here immediately.
  const { items, firstLoad, loading, done, sentinelRef } = usePaginatedList(
    api.admin.users,
    term ? "skip" : { filter },
    25
  );
  const results = useQuery(api.admin.searchUsers, term ? { query: term } : "skip");

  const rows = term ? results : firstLoad ? undefined : items;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="brand text-3xl text-foreground">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find an account to review it, suspend or restore it, or reset its
          profile. Every action is recorded in the audit log.
        </p>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-full max-w-sm">
          <Input
            id="admin-user-search"
            label="Search by handle"
            placeholder="@username"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        {!term && (
          <Segmented
            label="Filter users"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "new", label: "New (24h)" },
              { value: "suspended", label: "Suspended" },
            ]}
          />
        )}
      </div>

      {!term && filter === "new" && (
        <p className="text-xs text-muted-foreground">
          Accounts from the last 24 hours. &ldquo;New &amp; very active&rdquo; marks
          20+ posts or 100+ follows on day one — a reason to look, not proof of spam.
        </p>
      )}

      {rows === undefined ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface p-10 text-center text-muted-foreground">
          {term
            ? `No handles start with “${term}”.`
            : filter === "suspended"
              ? "No suspended accounts."
              : filter === "new"
                ? "No signups in the last 24 hours."
                : "No accounts yet."}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
          {rows.map((u) => (
            <li key={u.id}>
              <Link
                href={`/admin/users/${u.id}`}
                className="flex flex-wrap items-center gap-4 px-4 py-3 transition-colors hover:bg-muted"
              >
                <Avatar src={u.avatar_url} alt={u.username} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">@{u.username}</span>
                    <UserBadges user={u} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Joined {formatJoinDate(u.created_at)} · {u.post_count} posts ·{" "}
                    {u.follower_count} followers · {u.following_count} following
                  </p>
                  {u.suspended_at && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Suspended {formatRelative(u.suspended_at)}
                      {u.suspended_until
                        ? ` until ${new Date(u.suspended_until).toLocaleString()}`
                        : ""}
                      {u.suspended_reason ? ` — “${u.suspended_reason}”` : ""}
                    </p>
                  )}
                </div>
                <span aria-hidden className="text-muted-foreground">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!term && !done && !firstLoad && (
        <div ref={sentinelRef} className="flex justify-center py-4 text-muted-foreground">
          {loading && <Spinner />}
        </div>
      )}
    </div>
  );
}
