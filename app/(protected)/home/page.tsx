"use client";

import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { useViewer } from "@/components/providers/viewer";
import { InfiniteFeed } from "@/components/feed/infinite-feed";
import { PageHeader } from "@/components/nav/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClassName } from "@/components/ui/button";
import { HomeIcon } from "@/components/ui/icon";

export default function HomePage() {
  const viewer = useViewer();
  const feed = usePaginatedList(api.feed.following, {});

  return (
    <div>
      <PageHeader title="Home" />
      <InfiniteFeed
        feed={feed}
        currentUserId={viewer.id}
        empty={
          <EmptyState
            icon={<HomeIcon size={26} />}
            title="Your feed is quiet"
            description="Follow people to see their posts here, in order. Mazi never shows you anything you didn't ask for."
          >
            <div className="flex gap-2">
              <Link href="/search" className={buttonClassName({ size: "sm" })}>
                Find people
              </Link>
              <Link
                href="/communities"
                className={buttonClassName({ size: "sm", variant: "outline" })}
              >
                Browse communities
              </Link>
            </div>
          </EmptyState>
        }
      />
    </div>
  );
}
