import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/queries/profiles";
import {
  getCommunityBySlug,
  getCommunityMembers,
  getCommunityPosts,
} from "@/lib/queries/communities";
import { Avatar } from "@/components/ui/avatar";
import { PostCard } from "@/components/post/post-card";
import { PostComposer } from "@/components/post/post-composer";
import { JoinLeaveButton } from "@/components/community/join-leave-button";
import { InvitePanel } from "@/components/community/invite-panel";
import { CommunityCreatorSettings } from "@/components/community/community-creator-settings";
import { EmptyState } from "@/components/ui/empty-state";

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const community = await getCommunityBySlug(slug, currentUser.id);
  if (!community) notFound();

  const [members, posts] = await Promise.all([
    getCommunityMembers(community.id),
    getCommunityPosts(community.id, currentUser.id),
  ]);

  const canModerate =
    community.role === "creator" || community.role === "moderator";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{community.name}</h1>
            <p className="text-xs text-muted-foreground">
              {community.privacy_type === "invite_only"
                ? "Invite only"
                : "Public"}{" "}
              &middot; {community.members_count} members
            </p>
          </div>
          <JoinLeaveButton
            communityId={community.id}
            isMember={community.is_member}
            isCreator={community.role === "creator"}
            privacyType={community.privacy_type}
          />
        </div>
        {community.description && (
          <p className="mt-2 text-sm text-muted-foreground">
            {community.description}
          </p>
        )}
      </div>

      {community.role === "creator" && (
        <CommunityCreatorSettings
          community={{
            id: community.id,
            name: community.name,
            description: community.description,
            privacy_type: community.privacy_type,
          }}
        />
      )}

      {canModerate && <InvitePanel communityId={community.id} />}

      {community.is_member && (
        <PostComposer communities={[]} fixedCommunityId={community.id} />
      )}

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Posts
        </h2>
        {posts.length === 0 ? (
          <EmptyState title="No posts yet" description="Be the first to post in this community." />
        ) : (
          <div className="divide-y divide-border">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUser.id}
                canModerate={canModerate}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Members
        </h2>
        <div className="space-y-2">
          {members.map((member) => (
            <Link
              key={member.id}
              href={`/profile/${member.profile.username}`}
              className="flex items-center gap-2.5 rounded-md p-2 hover:bg-muted transition-colors"
            >
              <Avatar
                src={member.profile.avatar_url}
                alt={member.profile.username}
                size="sm"
              />
              <span className="text-sm font-medium">
                {member.profile.username}
              </span>
              {member.role !== "member" && (
                <span className="text-xs text-muted-foreground capitalize">
                  {member.role}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
