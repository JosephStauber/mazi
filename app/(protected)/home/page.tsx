import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFollowingFeed } from "@/lib/queries/feed";
import { loadMoreFollowing } from "@/lib/actions/feed";
import { InfiniteFeed } from "@/components/feed/infinite-feed";
import { PageHeader } from "@/components/nav/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { HomeIcon } from "@/components/ui/icon";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const followingPosts = await getFollowingFeed(authUser.id);

  return (
    <div>
      <PageHeader title="Home" />

      {followingPosts.length === 0 ? (
        <EmptyState
          icon={<HomeIcon size={26} />}
          title="Your feed is quiet"
          description="Follow people to see their posts here, in order. Mazi never shows you anything you didn't ask for."
        >
          <div className="flex gap-2">
            <Link href="/search">
              <Button size="sm">Find people</Button>
            </Link>
            <Link href="/communities">
              <Button size="sm" variant="outline">
                Browse communities
              </Button>
            </Link>
          </div>
        </EmptyState>
      ) : (
        <InfiniteFeed
          initialPosts={followingPosts}
          currentUserId={authUser.id}
          loadMore={loadMoreFollowing}
        />
      )}
    </div>
  );
}
