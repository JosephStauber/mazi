import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFollowingFeed } from "@/lib/queries/feed";
import { PostCard } from "@/components/post/post-card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  const userId = profile?.id ?? authUser.id;

  const followingPosts = await getFollowingFeed(userId);

  return (
    <div className="space-y-4">
      {followingPosts.length === 0 ? (
        <EmptyState
          title="No posts yet"
          description="Follow people to see their personal posts here. Community posts appear on the Communities page."
        />
      ) : (
        <div className="divide-y divide-border">
          {followingPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={userId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
