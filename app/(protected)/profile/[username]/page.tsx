import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser, getProfile, getFollowerCount, getFollowingCount, isFollowing, getUserCommunities } from "@/lib/queries/profiles";
import {
  ProfileEditProfileLink,
  ProfileSettingsGearLink,
} from "@/components/profile/profile-own-actions";
import { getPostsByUser } from "@/lib/queries/posts";
import { Avatar } from "@/components/ui/avatar";
import { PostCard } from "@/components/post/post-card";
import { FollowButton } from "@/components/profile/follow-button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const profile = await getProfile(username);
  if (!profile) notFound();

  const isOwnProfile = currentUser.id === profile.id;

  const [followers, following, userFollows, posts, communities] =
    await Promise.all([
      getFollowerCount(profile.id),
      getFollowingCount(profile.id),
      isOwnProfile ? Promise.resolve(false) : isFollowing(currentUser.id, profile.id),
      getPostsByUser(profile.id, currentUser.id),
      getUserCommunities(profile.id),
    ]);

  return (
    <div className="space-y-6">
      <div
        className={`relative flex items-start gap-4 ${isOwnProfile ? "pr-11" : ""}`}
      >
        {isOwnProfile ? <ProfileSettingsGearLink /> : null}
        <Avatar src={profile.avatar_url} alt={profile.username} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold truncate">{profile.username}</h1>
            {isOwnProfile ? (
              <ProfileEditProfileLink />
            ) : (
              <FollowButton
                targetUserId={profile.id}
                isFollowing={userFollows}
              />
            )}
          </div>
          {profile.bio && (
            <p className="mt-1 text-sm text-muted-foreground">{profile.bio}</p>
          )}
          <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{followers}</strong> followers
            </span>
            <span>
              <strong className="text-foreground">{following}</strong> following
            </span>
          </div>
        </div>
      </div>

      {communities.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Communities
          </h2>
          <div className="flex flex-wrap gap-2">
            {communities.map((cm) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const c = cm.communities as any;
              const community = Array.isArray(c) ? c[0] : c;
              if (!community) return null;
              return (
                <Link
                  key={cm.community_id}
                  href={`/communities/${community.slug}`}
                  className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted transition-colors"
                >
                  {community.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Posts
        </h2>
        {posts.length === 0 ? (
          <EmptyState title="No posts yet" />
        ) : (
          <div className="divide-y divide-border">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUser.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
