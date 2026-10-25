"use client";

import { useEffect, useState } from "react";
import { usePaginatedQuery } from "convex-helpers/react";
import type {
  PaginatedQueryArgs,
  PaginatedQueryReference,
  UsePaginatedQueryReturnType,
} from "convex/react";

export type PaginatedList<T> = {
  items: T[];
  /** First page still loading — render a skeleton/spinner. */
  firstLoad: boolean;
  loading: boolean;
  done: boolean;
  loadMore: () => void;
  sentinelRef: (el: HTMLElement | null) => void;
};

/**
 * Live "load more on scroll" over a paginated Convex query. Every loaded page
 * stays subscribed, so new posts, edits, deletes and like counts show up
 * without a refresh.
 *
 * Uses convex-helpers' `usePaginatedQuery` (not convex/react's) because the
 * feeds merge several index streams, which needs its stable page boundaries.
 *
 * `sentinelRef` is a callback ref: attach it to a marker rendered only while
 * `!done`; when it scrolls near the viewport the next page loads.
 */
export function usePaginatedList<Query extends PaginatedQueryReference>(
  query: Query,
  args: PaginatedQueryArgs<Query> | "skip",
  pageSize = 15
): PaginatedList<UsePaginatedQueryReturnType<Query>["results"][number]> {
  const { results, status, loadMore } = usePaginatedQuery(query, args, {
    initialNumItems: pageSize,
  });
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const canLoadMore = status === "CanLoadMore";

  useEffect(() => {
    if (!sentinel || !canLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore(pageSize);
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, canLoadMore, loadMore, pageSize]);

  return {
    items: results,
    firstLoad: status === "LoadingFirstPage",
    loading: status === "LoadingMore",
    done: status === "Exhausted",
    loadMore: () => {
      if (canLoadMore) loadMore(pageSize);
    },
    sentinelRef: setSentinel,
  };
}
