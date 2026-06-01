"use client";

import { useState } from "react";
import Link from "next/link";
import { Tabs } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PostCard } from "@/components/post/post-card";
import { CreateIcon } from "@/components/ui/icon";
import type {
  PostWithAuthor,
  CommunityMemberWithProfile,
} from "@/lib/types/database";

interface CommunityTabsProps {
  posts: PostWithAuthor[];
  members: CommunityMemberWithProfile[];
  currentUserId: string;
  canModerate: boolean;
}

export function CommunityTabs({
  posts,
  members,
  currentUserId,
  canModerate,
}: CommunityTabsProps) {
  const [tab, setTab] = useState<"posts" | "members">("posts");

  return (
    <div>
      <Tabs
        activeValue={tab}
        onChange={(v) => setTab(v as "posts" | "members")}
        items={[
          { label: "Posts", value: "posts", count: posts.length },
          { label: "Members", value: "members", count: members.length },
        ]}
      />

      {tab === "posts" ? (
        posts.length === 0 ? (
          <EmptyState
            icon={<CreateIcon size={24} />}
            title="No posts yet"
            description="Be the first to post in this community."
          />
        ) : (
          <div className="divide-y divide-border">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                canModerate={canModerate}
              />
            ))}
          </div>
        )
      ) : (
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
      )}
    </div>
  );
}
