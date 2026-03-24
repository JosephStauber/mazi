import Link from "next/link";
import type { CommunityWithMeta } from "@/lib/types/database";

interface CommunityCardProps {
  community: CommunityWithMeta;
}

export function CommunityCard({ community }: CommunityCardProps) {
  return (
    <Link
      href={`/communities/${community.slug}`}
      className="block rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{community.name}</h3>
        <span className="text-xs text-muted-foreground">
          {community.privacy_type === "invite_only" ? "Invite only" : "Public"}
        </span>
      </div>
      {community.description && (
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
          {community.description}
        </p>
      )}
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{community.members_count} members</span>
        {community.is_member && (
          <span className="rounded bg-foreground/5 px-1.5 py-0.5 font-medium text-foreground">
            Joined
          </span>
        )}
      </div>
    </Link>
  );
}
