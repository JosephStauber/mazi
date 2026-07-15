import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/queries/profiles";
import { getCommunities } from "@/lib/queries/communities";
import { getCommunitiesFeed } from "@/lib/queries/feed";
import { loadMoreCommunities } from "@/lib/actions/feed";
import { CommunityCard } from "@/components/community/community-card";
import { CreateCommunityForm } from "@/components/community/create-community-form";
import { CommunityFeedFilter } from "@/components/community/community-feed-filter";
import { InfiniteFeed } from "@/components/feed/infinite-feed";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/nav/page-header";
import { CommunitiesIcon } from "@/components/ui/icon";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function FeedFilterFallback() {
  return <div className="h-9 w-full max-w-xs animate-pulse rounded-full bg-muted" />;
}

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ community?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const communities = await getCommunities(user.id);
  const memberCommunities = communities
    .filter((c) => c.is_member)
    .map((c) => ({ id: c.id, name: c.name }));
  const memberIds = memberCommunities.map((c) => c.id);

  const { community: communityParam } = await searchParams;
  const filterId =
    communityParam &&
    UUID_RE.test(communityParam) &&
    memberCommunities.some((c) => c.id === communityParam)
      ? communityParam
      : null;

  // Reuse the membership ids we just read (getCommunities) instead of letting
  // getCommunitiesFeed re-query community_members for the same request.
  const communityFeed = await getCommunitiesFeed(
    user.id,
    filterId,
    null,
    memberIds
  );

  return (
    <div>
      <PageHeader title="Communities" action={<CreateCommunityForm />} />

      <section className="pt-4">
        {memberCommunities.length > 0 && (
          <div className="mb-3">
            <Suspense fallback={<FeedFilterFallback />}>
              <CommunityFeedFilter memberCommunities={memberCommunities} />
            </Suspense>
          </div>
        )}

        {memberCommunities.length === 0 ? (
          <EmptyState
            icon={<CommunitiesIcon size={24} />}
            title="Join the conversation"
            description="Join a community below to see its posts here, or create your own."
          />
        ) : communityFeed.items.length === 0 ? (
          <EmptyState
            icon={<CommunitiesIcon size={24} />}
            title="No posts yet"
            description={
              filterId
                ? "Nothing posted in this community recently."
                : "No posts in your communities yet."
            }
          />
        ) : (
          <InfiniteFeed
            initialPosts={communityFeed.items}
            initialCursor={communityFeed.nextCursor}
            currentUserId={user.id}
            loadMore={loadMoreCommunities.bind(null, filterId)}
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
    </div>
  );
}
