"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { PostCard } from "@/components/post/post-card";
import { Spinner } from "@/components/ui/spinner";
import { CreateIcon, ImageIcon } from "@/components/ui/icon";
import { useInfiniteList } from "@/lib/hooks/use-infinite-list";
import type { Page, PostWithAuthor } from "@/lib/types/database";

interface ProfileTabsProps {
  initialPosts: PostWithAuthor[];
  postsCursor: string | null;
  /** Total post count (all pages), for the header/Posts tab. */
  postsCount: number;
  loadMore: (cursor: string) => Promise<Page<PostWithAuthor>>;
  currentUserId: string;
  isOwnProfile: boolean;
}

export function ProfileTabs({
  initialPosts,
  postsCursor,
  postsCount,
  loadMore,
  currentUserId,
  isOwnProfile,
}: ProfileTabsProps) {
  const [tab, setTab] = useState<"posts" | "media">("posts");
  const { items: posts, loading, done, sentinelRef } = useInfiniteList({
    initialItems: initialPosts,
    initialCursor: postsCursor,
    loadMore,
  });

  // Media is derived from the posts loaded so far; scrolling the Posts tab loads
  // more and grows it.
  const media = useMemo(() => posts.filter((p) => p.image_url), [posts]);

  return (
    <div>
      <Tabs
        activeValue={tab}
        onChange={(v) => setTab(v as "posts" | "media")}
        items={[
          { label: "Posts", value: "posts", count: postsCount },
          { label: "Media", value: "media", count: media.length },
        ]}
      />

      {tab === "posts" ? (
        posts.length === 0 ? (
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
          <>
            <div className="divide-y divide-border">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
            {!done && (
              <div
                ref={sentinelRef}
                className="flex items-center justify-center py-8 text-muted-foreground"
              >
                {loading && <Spinner />}
              </div>
            )}
          </>
        )
      ) : media.length === 0 ? (
        <EmptyState
          icon={<ImageIcon size={24} />}
          title="No media yet"
          description="Posts with photos will appear here."
        />
      ) : (
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
      )}
    </div>
  );
}
