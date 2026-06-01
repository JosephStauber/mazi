import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { FollowButton } from "@/components/profile/follow-button";
import { UserPlusIcon } from "@/components/ui/icon";
import type { Profile } from "@/lib/types/database";

interface UserListProps {
  users: Profile[];
  currentUserId: string;
  followingIds: Set<string>;
  emptyTitle: string;
  emptyDescription?: string;
}

export function UserList({
  users,
  currentUserId,
  followingIds,
  emptyTitle,
  emptyDescription,
}: UserListProps) {
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
              isFollowing={followingIds.has(user.id)}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
