"use server";

// Load-more wrappers for keyset-paginated lists. Like `lib/actions/feed.ts`,
// these are server actions that read on the client's behalf (the only way a
// client component can page further under RLS). Each re-derives the caller from
// the session and delegates to the matching query.

import { createClient } from "@/lib/supabase/server";
import { getPostsByUser, getPostComments } from "@/lib/queries/posts";
import {
  getCommunityPosts,
  getCommunityMembers,
} from "@/lib/queries/communities";
import {
  getFollowers,
  getFollowingProfiles,
  getFollowedSubset,
} from "@/lib/queries/profiles";
import type {
  Page,
  PostWithAuthor,
  CommentWithAuthor,
  CommunityMemberWithProfile,
  UserPage,
} from "@/lib/types/database";

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function loadMoreProfilePosts(
  userId: string,
  cursor: string
): Promise<Page<PostWithAuthor>> {
  const uid = await requireUserId();
  if (!uid) return { items: [], nextCursor: null };
  return getPostsByUser(userId, uid, cursor);
}

export async function loadMoreCommunityPosts(
  communityId: string,
  cursor: string
): Promise<Page<PostWithAuthor>> {
  const uid = await requireUserId();
  if (!uid) return { items: [], nextCursor: null };
  return getCommunityPosts(communityId, uid, cursor);
}

export async function loadMoreCommunityMembers(
  communityId: string,
  cursor: string
): Promise<Page<CommunityMemberWithProfile>> {
  const uid = await requireUserId();
  if (!uid) return { items: [], nextCursor: null };
  return getCommunityMembers(communityId, cursor);
}

export async function loadMoreComments(
  postId: string,
  cursor: string
): Promise<Page<CommentWithAuthor>> {
  const uid = await requireUserId();
  if (!uid) return { items: [], nextCursor: null };
  return getPostComments(postId, cursor);
}

export async function loadMoreFollowers(
  userId: string,
  cursor: string
): Promise<UserPage> {
  const uid = await requireUserId();
  if (!uid) return { items: [], nextCursor: null, followedIds: [] };
  const page = await getFollowers(userId, cursor);
  const followed = await getFollowedSubset(
    uid,
    page.items.map((u) => u.id)
  );
  return { ...page, followedIds: [...followed] };
}

export async function loadMoreFollowingList(
  userId: string,
  cursor: string
): Promise<UserPage> {
  const uid = await requireUserId();
  if (!uid) return { items: [], nextCursor: null, followedIds: [] };
  const page = await getFollowingProfiles(userId, cursor);
  const followed = await getFollowedSubset(
    uid,
    page.items.map((u) => u.id)
  );
  return { ...page, followedIds: [...followed] };
}
