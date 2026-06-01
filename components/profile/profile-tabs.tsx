"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { PostCard } from "@/components/post/post-card";
import { CreateIcon, ImageIcon } from "@/components/ui/icon";
import type { PostWithAuthor } from "@/lib/types/database";

interface ProfileTabsProps {
  posts: PostWithAuthor[];
  currentUserId: string;
  isOwnProfile: boolean;
}

export function ProfileTabs({
  posts,
  currentUserId,
  isOwnProfile,
}: ProfileTabsProps) {
  const [tab, setTab] = useState<"posts" | "media">("posts");

  const media = useMemo(() => posts.filter((p) => p.image_url), [posts]);
  const list = tab === "posts" ? posts : media;

  return (
    <div>
      <Tabs
        activeValue={tab}
        onChange={(v) => setTab(v as "posts" | "media")}
        items={[
          { label: "Posts", value: "posts", count: posts.length },
          { label: "Media", value: "media", count: media.length },
        ]}
      />

      {list.length === 0 ? (
        tab === "posts" ? (
          <EmptyState
            icon={<CreateIcon size={24} />}
            title={isOwnProfile ? "Share your first post" : "No posts yet"}
            description={
              isOwnProfile
                ? "Your posts will show up here."
                : "When they post, you'll see it here."
            }
          >
            {isOwnProfile && (
              <Link
                href="/compose"
                className="text-sm font-semibold text-foreground hover:underline"
              >
                Create a post
              </Link>
            )}
          </EmptyState>
        ) : (
          <EmptyState
            icon={<ImageIcon size={24} />}
            title="No media yet"
            description="Posts with photos will appear here."
          />
        )
      ) : tab === "media" ? (
        <div className="grid grid-cols-3 gap-1 pt-1">
          {media.map((post) => (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              className="group relative aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.image_url ?? ""}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 ease-spring group-hover:scale-105"
              />
            </Link>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {list.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  );
}
