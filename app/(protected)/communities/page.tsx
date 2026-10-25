"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { useViewer } from "@/components/providers/viewer";
import { CommunityCard } from "@/components/community/community-card";
import { CreateCommunityForm } from "@/components/community/create-community-form";
import { CommunityFeedFilter } from "@/components/community/community-feed-filter";
import { InfiniteFeed } from "@/components/feed/infinite-feed";
import { EmptyState } from "@/components/ui/empty-state";
import { FeedSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/nav/page-header";
import { CommunitiesIcon } from "@/components/ui/icon";

function CommunitiesView() {
  const viewer = useViewer();
  const communities = useQuery(api.communities.list);
  const memberCommunities = (communities ?? [])
    .filter((c) => c.is_member)
    .map((c) => ({ id: c.id, name: c.name }));

  const communityParam = useSearchParams().get("community");
  const filterId =
    communityParam && memberCommunities.some((c) => c.id === communityParam)
      ? (communityParam as Id<"communities">)
      : undefined;

  const feed = usePaginatedList(
    api.feed.communities,
    filterId ? { communityId: filterId } : {}
  );

  if (communities === undefined) return <FeedSkeleton count={4} />;

  return (
    <>
      <section className="pt-4">
        {memberCommunities.length > 0 && (
          <div className="mb-3">
            <CommunityFeedFilter memberCommunities={memberCommunities} />
          </div>
        )}

        {memberCommunities.length === 0 ? (
          <EmptyState
            icon={<CommunitiesIcon size={24} />}
            title="Join the conversation"
            description="Join a community below to see its posts here, or create your own."
          />
        ) : (
          <InfiniteFeed
            feed={feed}
            currentUserId={viewer.id}
            empty={
              <EmptyState
                icon={<CommunitiesIcon size={24} />}
                title="No posts yet"
                description={
                  filterId
                    ? "Nothing posted in this community recently."
                    : "No posts in your communities yet."
                }
              />
            }
          />
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 px-1 text-sm font-semibold text-muted-foreground">
          Discover
        </h2>
        {communities.length === 0 ? (
          <EmptyState
            icon={<CommunitiesIcon size={24} />}
            title="No communities yet"
            description="Be the first — create a community to get things started."
          />
        ) : (
          <div className="grid gap-2.5">
            {communities.map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default function CommunitiesPage() {
  return (
    <div>
      <PageHeader title="Communities" action={<CreateCommunityForm />} />
      {/* useSearchParams needs a Suspense boundary in the App Router. */}
      <Suspense fallback={<FeedSkeleton count={4} />}>
        <CommunitiesView />
      </Suspense>
    </div>
  );
}
