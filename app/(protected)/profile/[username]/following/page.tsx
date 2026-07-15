import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  getProfile,
  getFollowingProfiles,
  getFollowedSubset,
} from "@/lib/queries/profiles";
import { loadMoreFollowingList } from "@/lib/actions/pagination";
import { UserList } from "@/components/profile/user-list";
import { PageHeader } from "@/components/nav/page-header";

export default async function FollowingPage({
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

  const following = await getFollowingProfiles(profile.id);
  const followedIds = await getFollowedSubset(
    currentUser.id,
    following.items.map((u) => u.id)
  );

  return (
    <div>
      <PageHeader title={profile.username} subtitle="Following" back />
      <div className="pt-2">
        <UserList
          initialUsers={following.items}
          initialCursor={following.nextCursor}
          initialFollowedIds={[...followedIds]}
          loadMore={loadMoreFollowingList.bind(null, profile.id)}
          currentUserId={currentUser.id}
          emptyTitle="Not following anyone yet"
          emptyDescription={`When @${profile.username} follows people, they'll appear here.`}
        />
      </div>
    </div>
  );
}
