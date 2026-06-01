import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/queries/profiles";
import {
  getCommunityBySlug,
  getCommunityMembers,
  getCommunityPosts,
} from "@/lib/queries/communities";
import { PostComposer } from "@/components/post/post-composer";
import { JoinLeaveButton } from "@/components/community/join-leave-button";
import { InvitePanel } from "@/components/community/invite-panel";
import { CommunityCreatorSettings } from "@/components/community/community-creator-settings";
import { CommunityTabs } from "@/components/community/community-tabs";
import { PageHeader } from "@/components/nav/page-header";
import { CommunitiesIcon, LockIcon } from "@/components/ui/icon";

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
    <div>
      <PageHeader title={community.name} back />

      <div className="px-1 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] bg-foreground text-background">
            <CommunitiesIcon size={30} />
          </div>
          <JoinLeaveButton
            communityId={community.id}
            isMember={community.is_member}
            isCreator={community.role === "creator"}
            privacyType={community.privacy_type}
          />
        </div>

        <div className="mt-3">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {community.name}
          </h1>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            {community.privacy_type === "invite_only" ? (
              <>
                <LockIcon size={13} /> Invite only
              </>
            ) : (
              "Public"
            )}
            <span className="text-subtle">·</span>
            <span>
              {community.members_count}{" "}
              {community.members_count === 1 ? "member" : "members"}
            </span>
          </div>
          {community.description && (
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
              {community.description}
            </p>
          )}
        </div>

        {community.role === "creator" && (
          <div className="mt-4">
            <CommunityCreatorSettings
              community={{
                id: community.id,
                name: community.name,
                description: community.description,
                privacy_type: community.privacy_type,
              }}
            />
          </div>
        )}

        {canModerate && (
          <div className="mt-4">
            <InvitePanel communityId={community.id} />
          </div>
        )}

        {community.is_member && (
          <div className="mt-4">
            <PostComposer
              communities={[]}
              fixedCommunityId={community.id}
              author={{
                username: currentUser.username,
                avatar_url: currentUser.avatar_url,
              }}
            />
          </div>
        )}
      </div>

      <div className="mt-6">
        <CommunityTabs
          posts={posts}
          members={members}
          currentUserId={currentUser.id}
          canModerate={canModerate}
        />
      </div>
    </div>
  );
}
