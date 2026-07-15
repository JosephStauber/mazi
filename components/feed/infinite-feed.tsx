"use client";

import { PostCard } from "@/components/post/post-card";
import { Spinner } from "@/components/ui/spinner";
import { useInfiniteList } from "@/lib/hooks/use-infinite-list";
import type { Page, PostWithAuthor } from "@/lib/types/database";

interface InfiniteFeedProps {
  initialPosts: PostWithAuthor[];
  initialCursor: string | null;
  currentUserId: string;
  loadMore: (cursor: string) => Promise<Page<PostWithAuthor>>;
  canModerate?: boolean;
}

export function InfiniteFeed({
  initialPosts,
  initialCursor,
  currentUserId,
  loadMore,
  canModerate,
}: InfiniteFeedProps) {
  const { items: posts, loading, done, sentinelRef } = useInfiniteList({
    initialItems: initialPosts,
    initialCursor,
    loadMore,
  });

  return (
    <div>
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

      {!done && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-8 text-muted-foreground"
        >
          {loading && <Spinner />}
        </div>
      )}

      {done && posts.length > 0 && (
        <p className="py-8 text-center text-xs text-subtle">
          You&apos;re all caught up.
        </p>
      )}
    </div>
  );
}
