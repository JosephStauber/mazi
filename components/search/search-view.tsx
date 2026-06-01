"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Tabs } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchIcon, CommunitiesIcon, CloseIcon } from "@/components/ui/icon";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Community } from "@/lib/types/database";

/** Remove LIKE metacharacters so user input cannot widen ILIKE patterns. */
function sanitizeSearchTerm(q: string): string {
  return q.replace(/[%_\\]/g, "").trim();
}

type Tab = "all" | "people" | "communities";

export function SearchView() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const safe = sanitizeSearchTerm(query);
    if (safe.length < 2) {
      setUsers([]);
      setCommunities([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const pattern = `%${safe}%`;
      const [usersRes, communitiesRes] = await Promise.all([
        supabase.from("profiles").select("*").ilike("username", pattern).limit(20),
        supabase.from("communities").select("*").ilike("name", pattern).limit(20),
      ]);
      if (id !== reqId.current) return; // stale response
      setUsers(usersRes.data ?? []);
      setCommunities(communitiesRes.data ?? []);
      setSearched(true);
      setLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const showPeople = tab === "all" || tab === "people";
  const showCommunities = tab === "all" || tab === "communities";
  const noResults = searched && users.length === 0 && communities.length === 0;

  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle">
          <SearchIcon size={18} />
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people and communities"
          autoFocus
          className="h-11 w-full rounded-full border border-border bg-muted/40 pl-11 pr-10 text-[15px] text-foreground placeholder:text-subtle transition-colors focus:border-foreground focus:bg-background focus:outline-none focus:ring-4 focus:ring-foreground/5"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CloseIcon size={16} />
          </button>
        )}
      </div>

      {searched && (
        <div className="mt-4">
          <Tabs
            activeValue={tab}
            onChange={(v) => setTab(v as Tab)}
            items={[
              { label: "All", value: "all" },
              { label: "People", value: "people", count: users.length },
              {
                label: "Communities",
                value: "communities",
                count: communities.length,
              },
            ]}
          />
        </div>
      )}

      {loading && !searched && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {noResults && (
        <EmptyState
          icon={<SearchIcon size={24} />}
          title="No results"
          description={`Nothing matched "${query.trim()}". Try a different search.`}
        />
      )}

      {!searched && !loading && (
        <EmptyState
          icon={<SearchIcon size={24} />}
          title="Search Mazi"
          description="Find people to follow and communities to join."
        />
      )}

      {searched && !noResults && (
        <div className="mt-2 divide-y divide-border">
          {showPeople &&
            users.map((user) => (
              <Link
                key={user.id}
                href={`/profile/${user.username}`}
                className="flex items-center gap-3 py-3.5 transition-colors hover:bg-muted/40"
              >
                <Avatar src={user.avatar_url} alt={user.username} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {user.username}
                  </p>
                  {user.bio && (
                    <p className="truncate text-sm text-muted-foreground">
                      {user.bio}
                    </p>
                  )}
                </div>
              </Link>
            ))}

          {showCommunities &&
            communities.map((community) => (
              <Link
                key={community.id}
                href={`/communities/${community.slug}`}
                className="flex items-center gap-3 py-3.5 transition-colors hover:bg-muted/40"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-muted text-muted-foreground">
                  <CommunitiesIcon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {community.name}
                  </p>
                  {community.description && (
                    <p className="truncate text-sm text-muted-foreground">
                      {community.description}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-subtle">
                  {community.privacy_type === "invite_only"
                    ? "Invite only"
                    : "Public"}
                </span>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
