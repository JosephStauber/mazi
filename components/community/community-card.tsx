import Link from "next/link";
import { CommunitiesIcon, LockIcon, CheckIcon } from "@/components/ui/icon";
import type { CommunityWithMeta } from "@/lib/types/database";

interface CommunityCardProps {
  community: CommunityWithMeta;
}

export function CommunityCard({ community }: CommunityCardProps) {
  return (
    <Link
      href={`/communities/${community.slug}`}
      className="group flex items-start gap-3.5 rounded-[var(--radius-lg)] border border-border p-4 transition-all hover:border-border-strong hover:bg-muted/40 active:scale-[0.99]"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-foreground text-background">
        <CommunitiesIcon size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {community.name}
          </h3>
          {community.privacy_type === "invite_only" && (
            <LockIcon size={13} className="shrink-0 text-subtle" />
          )}
        </div>
        {community.description && (
          <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {community.description}
          </p>
        )}
        <p className="mt-1.5 text-xs text-subtle">
          {community.members_count}{" "}
          {community.members_count === 1 ? "member" : "members"}
        </p>
      </div>
      {community.is_member && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
          <CheckIcon size={12} /> Joined
        </span>
      )}
    </Link>
  );
}
