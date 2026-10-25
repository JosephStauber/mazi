"use client";

import { useState } from "react";
import Link from "next/link";
import { Tabs } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { InfiniteFeed } from "@/components/feed/infinite-feed";
import { CreateIcon } from "@/components/ui/icon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";

interface CommunityTabsProps {
  communityId: string;
  /** Total member count (all pages), for the Members tab. */
  membersCount: number;
  currentUserId: string;
  canModerate: boolean;
}

export function CommunityTabs({
  communityId,
  membersCount,
  currentUserId,
  canModerate,
}: CommunityTabsProps) {
  const [tab, setTab] = useState<"posts" | "members">("posts");
  const id = communityId as Id<"communities">;
  const posts = usePaginatedList(api.feed.community, { communityId: id });
  const {
    items: members,
    loading: membersLoading,
    done: membersDone,
    sentinelRef: membersSentinel,
  } = usePaginatedList(api.communities.members, tab === "members" ? { communityId: id } : "skip", 30);

  return (
    <div>
      <Tabs
        activeValue={tab}
        onChange={(v) => setTab(v as "posts" | "members")}
        items={[
          { label: "Posts", value: "posts" },
          { label: "Members", value: "members", count: membersCount },
        ]}
      />

      {tab === "posts" ? (
        <InfiniteFeed
          feed={posts}
          currentUserId={currentUserId}
          canModerate={canModerate}
          empty={
            <EmptyState
              icon={<CreateIcon size={24} />}
              title="No posts yet"
              description="Be the first to post in this community."
            />
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-border">
            {members.map((member) => (
              <li key={member.id}>
                <Link
                  href={`/profile/${member.profile.username}`}
                  className="flex items-center gap-3 py-3.5 transition-colors hover:bg-muted/40"
                >
                  <Avatar
                    src={member.profile.avatar_url}
                    alt={member.profile.username}
                    size="md"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                    {member.profile.username}
                  </span>
                  {member.role !== "member" && (
                    <Badge className="capitalize">{member.role}</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {!membersDone && (
            <div
              ref={membersSentinel}
              className="flex items-center justify-center py-8 text-muted-foreground"
            >
              {membersLoading && <Spinner />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
