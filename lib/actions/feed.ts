"use server";

import { createClient } from "@/lib/supabase/server";
import { getFollowingFeed, getCommunitiesFeed } from "@/lib/queries/feed";
import type { Page, PostWithAuthor } from "@/lib/types/database";

const EMPTY: Page<PostWithAuthor> = { items: [], nextCursor: null };

export async function loadMoreFollowing(
  cursor: string
): Promise<Page<PostWithAuthor>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;
  return getFollowingFeed(user.id, cursor);
}

// `communityId` is first so the communities page can `.bind(null, filterId)` it
// and hand `InfiniteFeed` a plain `(cursor) => Page` loader.
export async function loadMoreCommunities(
  communityId: string | null,
  cursor: string
): Promise<Page<PostWithAuthor>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;
  return getCommunitiesFeed(user.id, communityId, cursor);
}
