"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Community } from "@/lib/types/database";

/** Remove LIKE metacharacters so user input cannot widen ILIKE patterns. */
function sanitizeSearchTerm(q: string): string {
  return q.replace(/[%_\\]/g, "").trim();
}

export function SearchView() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    setError(null);
    const safe = sanitizeSearchTerm(q);
    if (safe.length < 2) {
      setUsers([]);
      setCommunities([]);
      setSearched(false);
      return;
    }

    const supabase = createClient();
    const pattern = `%${safe}%`;
    const [usersRes, communitiesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .ilike("username", pattern)
        .limit(20),
      supabase
        .from("communities")
        .select("*")
        .ilike("name", pattern)
        .limit(20),
    ]);

    const err =
      usersRes.error?.message ??
      communitiesRes.error?.message ??
      null;
    if (err) setError(err);

    setUsers(usersRes.data ?? []);
    setCommunities(communitiesRes.data ?? []);
    setSearched(true);
  }, []);

  return (
    <div className="space-y-6">
      <Input
        placeholder="Search users or communities..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        autoFocus
      />

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      {searched && users.length === 0 && communities.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No results found
        </p>
      )}

      {users.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Users
          </h2>
          <div className="space-y-1">
            {users.map((user) => (
              <Link
                key={user.id}
                href={`/profile/${user.username}`}
                className="flex items-center gap-2.5 rounded-md p-2 hover:bg-muted transition-colors"
              >
                <Avatar
                  src={user.avatar_url}
                  alt={user.username}
                  size="sm"
                />
                <div>
                  <span className="text-sm font-medium">{user.username}</span>
                  {user.bio && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {user.bio}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {communities.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Communities
          </h2>
          <div className="space-y-1">
            {communities.map((community) => (
              <Link
                key={community.id}
                href={`/communities/${community.slug}`}
                className="flex items-center justify-between rounded-md p-2 hover:bg-muted transition-colors"
              >
                <div>
                  <span className="text-sm font-medium">{community.name}</span>
                  {community.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {community.description}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {community.privacy_type === "invite_only"
                    ? "Invite only"
                    : "Public"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
