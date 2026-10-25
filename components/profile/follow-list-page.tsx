"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useViewer } from "@/components/providers/viewer";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { UserList } from "@/components/profile/user-list";
import { PageHeader } from "@/components/nav/page-header";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { UserPlusIcon } from "@/components/ui/icon";

/** Shared body of /profile/[username]/followers and /following. */
export function FollowListPage({ kind }: { kind: "followers" | "following" }) {
  const { username } = useParams<{ username: string }>();
  const viewer = useViewer();
  const data = useQuery(api.profiles.byUsername, { username });
  const userId = data?.profile.id as Id<"profiles"> | undefined;
  const list = usePaginatedList(
    kind === "followers" ? api.profiles.followers : api.profiles.following,
    userId ? { userId } : "skip",
    20
  );

  if (data === null) {
    return (
      <div>
        <PageHeader title="Profile" back />
        <EmptyState icon={<UserPlusIcon size={24} />} title="This account doesn't exist" />
      </div>
    );
  }

  const name = data?.profile.username ?? decodeURIComponent(username);
  return (
    <div>
      <PageHeader
        title={name}
        subtitle={kind === "followers" ? "Followers" : "Following"}
        back
      />
      <div className="pt-2">
        {!data ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Spinner />
          </div>
        ) : (
          <UserList
            list={list}
            currentUserId={viewer.id}
            emptyTitle={kind === "followers" ? "No followers yet" : "Not following anyone yet"}
            emptyDescription={
              kind === "followers"
                ? `When someone follows @${name}, they'll appear here.`
                : `When @${name} follows people, they'll appear here.`
            }
          />
        )}
      </div>
    </div>
  );
}
