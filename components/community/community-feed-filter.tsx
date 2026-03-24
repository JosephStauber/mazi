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
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <h2 className="text-sm font-semibold text-foreground">Community feed</h2>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:min-w-[220px] sm:flex-1 sm:max-w-sm">
        <span className="sr-only sm:not-sr-only">Show posts from</span>
        <select
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
    </div>
  );
}
