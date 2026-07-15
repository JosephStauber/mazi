"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { FollowButton } from "@/components/profile/follow-button";
import { UserPlusIcon } from "@/components/ui/icon";
import { useInfiniteList } from "@/lib/hooks/use-infinite-list";
import type { ProfileListItem, UserPage } from "@/lib/types/database";

interface UserListProps {
  initialUsers: ProfileListItem[];
  initialCursor: string | null;
  /** Ids among the initial users that the current user follows. */
  initialFollowedIds: string[];
  loadMore: (cursor: string) => Promise<UserPage>;
  currentUserId: string;
  emptyTitle: string;
  emptyDescription?: string;
}

export function UserList({
  initialUsers,
  initialCursor,
  initialFollowedIds,
  loadMore,
  currentUserId,
  emptyTitle,
  emptyDescription,
}: UserListProps) {
  const [followedIds, setFollowedIds] = useState<Set<string>>(
    () => new Set(initialFollowedIds)
  );

  const onPage = useCallback((page: UserPage) => {
    setFollowedIds((prev) => new Set([...prev, ...page.followedIds]));
  }, []);

  const { items: users, loading, done, sentinelRef } = useInfiniteList<
    ProfileListItem,
    UserPage
  >({
    initialItems: initialUsers,
    initialCursor,
    loadMore,
    onPage,
  });

  if (users.length === 0) {
    return (
      <EmptyState
        icon={<UserPlusIcon size={24} />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {users.map((user) => (
          <li key={user.id} className="flex items-center gap-3 py-3.5">
            <Link href={`/profile/${user.username}`} className="shrink-0">
              <Avatar src={user.avatar_url} alt={user.username} size="md" />
            </Link>
            <Link href={`/profile/${user.username}`} className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground hover:underline">
                {user.username}
              </p>
              {user.bio && (
                <p className="truncate text-sm text-muted-foreground">
                  {user.bio}
                </p>
              )}
            </Link>
            {user.id !== currentUserId && (
              <FollowButton
                targetUserId={user.id}
                isFollowing={followedIds.has(user.id)}
              />
            )}
          </li>
        ))}
      </ul>
      {!done && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-8 text-muted-foreground"
        >
          {loading && <Spinner />}
        </div>
      )}
    </>
  );
}
