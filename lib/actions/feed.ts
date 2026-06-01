"use server";

import { createClient } from "@/lib/supabase/server";
import { getFollowingFeed, getCommunitiesFeed } from "@/lib/queries/feed";
import type { PostWithAuthor } from "@/lib/types/database";

export async function loadMoreFollowing(
  cursor: string
): Promise<PostWithAuthor[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return getFollowingFeed(user.id, cursor);
}

export async function loadMoreCommunities(
  cursor: string,
  communityId?: string | null
): Promise<PostWithAuthor[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return getCommunitiesFeed(user.id, communityId ?? null, cursor);
}
