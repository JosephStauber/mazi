import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/queries/profiles";
import { getCommunities } from "@/lib/queries/communities";
import { getCommunitiesFeed } from "@/lib/queries/feed";
import { CommunityCard } from "@/components/community/community-card";
import { CreateCommunityForm } from "@/components/community/create-community-form";
import { CommunityFeedFilter } from "@/components/community/community-feed-filter";
import { PostCard } from "@/components/post/post-card";
import { EmptyState } from "@/components/ui/empty-state";

function FeedFilterFallback() {
  return (
    <div className="h-9 w-full max-w-sm animate-pulse rounded-md bg-muted sm:ml-auto" />
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const { community: communityParam } = await searchParams;
  const filterId =
    communityParam &&
    UUID_RE.test(communityParam) &&
    memberCommunities.some((c) => c.id === communityParam)
      ? communityParam
      : null;

  const communityPosts = await getCommunitiesFeed(user.id, filterId);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold">Communities</h1>
          <CreateCommunityForm />
        </div>

        <Suspense fallback={<FeedFilterFallback />}>
          <CommunityFeedFilter memberCommunities={memberCommunities} />
        </Suspense>

        {memberCommunities.length === 0 ? (
          <EmptyState
            title="No community posts yet"
            description="Join a community below to see its posts here, or create your own."
          />
        ) : communityPosts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description={
              filterId
                ? "Nothing posted in this community recently."
                : "No posts in your communities yet."
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {communityPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={user.id}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Browse communities
        </h2>
        {communities.length === 0 ? (
          <EmptyState
            title="No communities yet"
            description="Create the first community or wait for others to start one."
          />
        ) : (
          <div className="grid gap-3">
            {communities.map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
