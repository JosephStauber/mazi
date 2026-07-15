"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Page } from "@/lib/types/database";

interface Options<T, P extends Page<T>> {
  initialItems: T[];
  initialCursor: string | null;
  loadMore: (cursor: string) => Promise<P>;
  /** Observe the whole page (e.g. to read fields beyond `items`/`nextCursor`). */
  onPage?: (page: P) => void;
}

/**
 * Keyset "load more on scroll" for any list whose loader returns a `Page`.
 *
 * `sentinelRef` is a callback ref: attach it to a marker element rendered only
 * while `!done`. Because it is a callback ref, mounting/unmounting the marker
 * (e.g. switching tabs) re-attaches or tears down the observer correctly, and
 * re-arming after each page keeps a marker that stays in view auto-advancing.
 */
export function useInfiniteList<T extends { id: string }, P extends Page<T> = Page<T>>({
  initialItems,
  initialCursor,
  loadMore,
  onPage,
}: Options<T, P>) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const loadingRef = useRef(false);
  const done = cursor === null;

  // Keep loader/callback identity out of the effect deps so a parent that
  // re-creates them per render doesn't thrash the observer.
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  const onPageRef = useRef(onPage);
  onPageRef.current = onPage;

  const fetchMore = useCallback(async () => {
    if (loadingRef.current || cursor === null) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const page = await loadMoreRef.current(cursor);
      onPageRef.current?.(page);
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    if (!sentinel || done) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) fetchMore();
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, fetchMore, done]);

  return { items, setItems, loading, done, sentinelRef: setSentinel };
}
