"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PostCard } from "@/components/post/post-card";
import { Spinner } from "@/components/ui/spinner";
import type { PostWithAuthor } from "@/lib/types/database";

const PAGE_SIZE = 15;

interface InfiniteFeedProps {
  initialPosts: PostWithAuthor[];
  currentUserId: string;
  loadMore: (cursor: string) => Promise<PostWithAuthor[]>;
  canModerate?: boolean;
}

export function InfiniteFeed({
  initialPosts,
  currentUserId,
  loadMore,
  canModerate,
}: InfiniteFeedProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initialPosts.length < PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const fetchMore = useCallback(async () => {
    if (loadingRef.current || done) return;
    const last = posts[posts.length - 1];
    if (!last) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const next = await loadMore(last.created_at);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...next.filter((p) => !seen.has(p.id))];
      });
      if (next.length < PAGE_SIZE) setDone(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [posts, done, loadMore]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || done) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) fetchMore();
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchMore, done]);

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
