"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface CommunityFeedFilterProps {
  /** Communities the user is a member of (for the filter dropdown). */
  memberCommunities: { id: string; name: string }[];
}

export function CommunityFeedFilter({
  memberCommunities,
}: CommunityFeedFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = searchParams.get("community") ?? "";

  if (memberCommunities.length === 0) return null;
  /* One membership: same feed for "all" vs that community — hide selector. */
  if (memberCommunities.length === 1) return null;

  function onChange(communityId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (communityId) {
      params.set("community", communityId);
    } else {
      params.delete("community");
    }
    const q = params.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="shrink-0">Showing</span>
      <select
        className="h-9 flex-1 rounded-full border border-border bg-muted/40 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:border-foreground focus:outline-none focus:ring-4 focus:ring-foreground/5"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All my communities</option>
        {memberCommunities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
