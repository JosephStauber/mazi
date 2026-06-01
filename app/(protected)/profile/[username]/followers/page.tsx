import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  getProfile,
  getFollowers,
  getFollowingIdSet,
} from "@/lib/queries/profiles";
import { UserList } from "@/components/profile/user-list";
import { PageHeader } from "@/components/nav/page-header";

export default async function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const profile = await getProfile(username);
  if (!profile) notFound();

  const [followers, followingIds] = await Promise.all([
    getFollowers(profile.id),
    getFollowingIdSet(currentUser.id),
  ]);

  return (
    <div>
      <PageHeader title={profile.username} subtitle="Followers" back />
      <div className="pt-2">
        <UserList
          users={followers}
          currentUserId={currentUser.id}
          followingIds={followingIds}
          emptyTitle="No followers yet"
          emptyDescription={`When someone follows @${profile.username}, they'll appear here.`}
        />
      </div>
    </div>
  );
}
