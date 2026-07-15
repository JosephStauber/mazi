import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  getProfile,
  getFollowers,
  getFollowedSubset,
} from "@/lib/queries/profiles";
import { loadMoreFollowers } from "@/lib/actions/pagination";
import { UserList } from "@/components/profile/user-list";
import { PageHeader } from "@/components/nav/page-header";

export default async function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const [currentUser, profile] = await Promise.all([
    getCurrentUser(),
    getProfile(username),
  ]);
  if (!currentUser) redirect("/login");
  if (!profile) notFound();

  const followers = await getFollowers(profile.id);
  const followedIds = await getFollowedSubset(
    currentUser.id,
    followers.items.map((u) => u.id)
  );

  return (
    <div>
      <PageHeader title={profile.username} subtitle="Followers" back />
      <div className="pt-2">
        <UserList
          initialUsers={followers.items}
          initialCursor={followers.nextCursor}
          initialFollowedIds={[...followedIds]}
          loadMore={loadMoreFollowers.bind(null, profile.id)}
          currentUserId={currentUser.id}
          emptyTitle="No followers yet"
          emptyDescription={`When someone follows @${profile.username}, they'll appear here.`}
        />
      </div>
    </div>
  );
}
