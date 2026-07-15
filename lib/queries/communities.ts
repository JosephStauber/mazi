import { createClient } from "@/lib/supabase/server";
import { enrichPosts } from "@/lib/queries/feed";
import type {
  Page,
  CommunityWithMeta,
  CommunityMemberWithProfile,
  PostWithAuthor,
} from "@/lib/types/database";
import { decodeCursor, keysetFilter, pageFromRows } from "@/lib/utils/cursor";

export const COMMUNITY_POSTS_PAGE_SIZE = 15;
export const COMMUNITY_MEMBERS_PAGE_SIZE = 30;

const POST_SELECT = `*, author:profiles!author_id(id, username, avatar_url), community:communities!community_id(id, name, slug), likes(count), comments(count)`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowKey = (r: any) => ({ created_at: r.created_at, id: r.id });

export async function getCommunities(
  userId: string
): Promise<CommunityWithMeta[]> {
  const supabase = await createClient();

  // Member counts come from an embedded aggregate (community_members SELECT is
  // world-readable to authenticated users), so we never transfer member rows
  // just to count them. Only the caller's own memberships are read, for
  // is_member / role.
  const { data: communities } = await supabase
    .from("communities")
    .select("*, community_members(count)")
    .order("created_at", { ascending: false });

  if (!communities) return [];

  const { data: userMemberships } = await supabase
    .from("community_members")
    .select("community_id, role")
    .eq("user_id", userId);

  const memberMap: Record<string, string> = {};
  (userMemberships ?? []).forEach(
    (m: { community_id: string; role: string }) => {
      memberMap[m.community_id] = m.role;
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return communities.map(({ community_members, ...c }: any) => ({
    ...c,
    members_count: Array.isArray(community_members)
      ? community_members[0]?.count ?? 0
      : 0,
    is_member: !!memberMap[c.id],
    role: (memberMap[c.id] as CommunityWithMeta["role"]) ?? null,
  }));
}

export async function getCommunityBySlug(
  slug: string,
  userId: string
): Promise<CommunityWithMeta | null> {
  const supabase = await createClient();

  const { data: community } = await supabase
    .from("communities")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!community) return null;

  const [{ count }, { data: membership }] = await Promise.all([
    supabase
      .from("community_members")
      .select("*", { count: "exact", head: true })
      .eq("community_id", community.id),
    supabase
      .from("community_members")
      .select("role")
      .eq("community_id", community.id)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  return {
    ...community,
    members_count: count ?? 0,
    is_member: !!membership,
    role: (membership?.role as CommunityWithMeta["role"]) ?? null,
  };
}

export async function getCommunityMembers(
  communityId: string,
  cursor?: string | null
): Promise<Page<CommunityMemberWithProfile>> {
  const supabase = await createClient();

  let query = supabase
    .from("community_members")
    .select(`*, profile:profiles!user_id(id, username, avatar_url)`)
    .eq("community_id", communityId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(COMMUNITY_MEMBERS_PAGE_SIZE + 1);

  const decoded = decodeCursor(cursor);
  if (decoded) query = query.or(keysetFilter(decoded, "asc"));

  const { data } = await query;
  if (!data) return { items: [], nextCursor: null };

  const { pageRows, nextCursor } = pageFromRows(
    data,
    COMMUNITY_MEMBERS_PAGE_SIZE,
    rowKey
  );
  return { items: pageRows as CommunityMemberWithProfile[], nextCursor };
}

export async function getCommunityPosts(
  communityId: string,
  currentUserId: string,
  cursor?: string | null
): Promise<Page<PostWithAuthor>> {
  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(COMMUNITY_POSTS_PAGE_SIZE + 1);

  const decoded = decodeCursor(cursor);
  if (decoded) query = query.or(keysetFilter(decoded, "desc"));

  const { data: rows } = await query;
  if (!rows) return { items: [], nextCursor: null };

  const { pageRows, nextCursor } = pageFromRows(
    rows,
    COMMUNITY_POSTS_PAGE_SIZE,
    rowKey
  );
  const items = await enrichPosts(supabase, pageRows, currentUserId);
  return { items, nextCursor };
}
