import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  getCurrentUser,
  getProfile,
  getFollowerCount,
  getFollowingCount,
  isFollowing,
  getUserCommunities,
} from "@/lib/queries/profiles";
import { getPostsByUser } from "@/lib/queries/posts";
import { Avatar } from "@/components/ui/avatar";
import { FollowButton } from "@/components/profile/follow-button";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { PageHeader } from "@/components/nav/page-header";
import { SettingsIcon } from "@/components/ui/icon";
import { formatJoinDate } from "@/lib/utils/date";

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
      isOwnProfile
        ? Promise.resolve(false)
        : isFollowing(currentUser.id, profile.id),
      getPostsByUser(profile.id, currentUser.id),
      getUserCommunities(profile.id),
    ]);

  const base = `/profile/${profile.username}`;

  return (
    <div>
      <PageHeader
        title={profile.username}
        subtitle={`${posts.length} ${posts.length === 1 ? "post" : "posts"}`}
        back
        action={
          isOwnProfile ? (
            <Link
              href="/settings"
              aria-label="Settings"
              className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
            >
              <SettingsIcon size={20} />
            </Link>
          ) : undefined
        }
      />

      <div className="px-1 pt-5">
        <div className="flex items-start justify-between gap-4">
          <Avatar src={profile.avatar_url} alt={profile.username} size="xl" />
          {isOwnProfile ? (
            <Link
              href="/settings/profile"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
            >
              Edit profile
            </Link>
          ) : (
            <FollowButton
              targetUserId={profile.id}
              isFollowing={userFollows}
              size="md"
            />
          )}
        </div>

        <div className="mt-3">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {profile.username}
          </h1>
          {profile.bio && (
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
              {profile.bio}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <Link href={`${base}/following`} className="hover:text-foreground">
              <strong className="font-semibold text-foreground">
                {following}
              </strong>{" "}
              following
            </Link>
            <Link href={`${base}/followers`} className="hover:text-foreground">
              <strong className="font-semibold text-foreground">
                {followers}
              </strong>{" "}
              {followers === 1 ? "follower" : "followers"}
            </Link>
            <span>Joined {formatJoinDate(profile.created_at)}</span>
          </div>
        </div>

        {communities.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {communities.map((cm) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const c = cm.communities as any;
              const community = Array.isArray(c) ? c[0] : c;
              if (!community) return null;
              return (
                <Link
                  key={cm.community_id}
                  href={`/communities/${community.slug}`}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {community.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6">
        <ProfileTabs
          posts={posts}
          currentUserId={currentUser.id}
          isOwnProfile={isOwnProfile}
        />
      </div>
    </div>
  );
}
