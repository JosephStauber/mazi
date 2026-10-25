"use client";

import type { ReactNode } from "react";
import { PostCard } from "@/components/post/post-card";
import { Spinner } from "@/components/ui/spinner";
import { FeedSkeleton } from "@/components/ui/skeleton";
import type { PaginatedList } from "@/lib/hooks/use-paginated-list";
import type { PostWithAuthor } from "@/lib/types/database";

interface InfiniteFeedProps {
  feed: PaginatedList<PostWithAuthor>;
  currentUserId: string;
  canModerate?: boolean;
  /** Rendered instead of the list when the feed has no posts. */
  empty?: ReactNode;
}

export function InfiniteFeed({ feed, currentUserId, canModerate, empty }: InfiniteFeedProps) {
  const { items: posts, firstLoad, loading, done, sentinelRef } = feed;

  if (firstLoad) return <FeedSkeleton count={4} />;
  if (posts.length === 0 && done && empty) return <>{empty}</>;

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
