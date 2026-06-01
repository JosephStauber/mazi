import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  getProfile,
  getFollowingProfiles,
  getFollowingIdSet,
} from "@/lib/queries/profiles";
import { UserList } from "@/components/profile/user-list";
import { PageHeader } from "@/components/nav/page-header";

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const profile = await getProfile(username);
  if (!profile) notFound();

  const [following, followingIds] = await Promise.all([
    getFollowingProfiles(profile.id),
    getFollowingIdSet(currentUser.id),
  ]);

  return (
    <div>
      <PageHeader title={profile.username} subtitle="Following" back />
      <div className="pt-2">
        <UserList
          users={following}
          currentUserId={currentUser.id}
          followingIds={followingIds}
          emptyTitle="Not following anyone yet"
          emptyDescription={`When @${profile.username} follows people, they'll appear here.`}
        />
      </div>
    </div>
  );
}
