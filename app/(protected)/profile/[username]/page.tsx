"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useViewer } from "@/components/providers/viewer";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { FeedSkeleton } from "@/components/ui/skeleton";
import { FollowButton } from "@/components/profile/follow-button";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { PageHeader } from "@/components/nav/page-header";
import { SettingsIcon, UserPlusIcon } from "@/components/ui/icon";
import { formatJoinDate } from "@/lib/utils/date";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const currentUser = useViewer();
  const data = useQuery(api.profiles.byUsername, { username });

  if (data === undefined) {
    return (
      <div>
        <PageHeader title={decodeURIComponent(username)} back />
        <FeedSkeleton count={3} />
      </div>
    );
  }
  if (data === null) {
    return (
      <div>
        <PageHeader title="Profile" back />
        <EmptyState
          icon={<UserPlusIcon size={24} />}
          title="This account doesn't exist"
          description="Try searching for another username."
        />
      </div>
    );
  }

  const { profile, followers, following, posts_count: postsCount, is_own: isOwnProfile } = data;
  const base = `/profile/${profile.username}`;

  return (
    <div>
      <PageHeader
        title={profile.username}
        subtitle={`${postsCount} ${postsCount === 1 ? "post" : "posts"}`}
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
              isFollowing={data.is_following}
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

        {data.communities.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.communities.map((community) => (
              <Link
                key={community.id}
                href={`/communities/${community.slug}`}
                className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {community.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <ProfileTabs
          userId={profile.id}
          postsCount={postsCount}
          currentUserId={currentUser.id}
          isOwnProfile={isOwnProfile}
        />
      </div>
    </div>
  );
}
