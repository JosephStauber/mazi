import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { mapSupabaseUserMessage } from "@/lib/supabase/map-error";
import type { Page, Profile, ProfileListItem } from "@/lib/types/database";
import { decodeCursor, keysetFilter, pageFromRows } from "@/lib/utils/cursor";

export const FOLLOWS_PAGE_SIZE = 20;

function fallbackProfileFromAuthUser(user: User): Profile {
  return {
    id: user.id,
    username:
      (user.user_metadata?.username as string | undefined) ??
      user.email?.split("@")[0] ??
      "user",
    bio: null,
    avatar_url: null,
    created_at: new Date().toISOString(),
    // A missing profile row is a pathological "trigger never ran" case; default
    // to full access so we never lock an existing user out of their own app.
    access_level: "full",
  };
}

export async function getProfile(username: string): Promise<Profile | null> {
  const supabase = await createClient();
  let handle = username.trim();
  try {
    handle = decodeURIComponent(handle);
  } catch {
    /* keep trimmed raw segment */
  }

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", handle)
    .maybeSingle();
  return data;
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data;
}

/**
 * The authenticated auth user, request-memoized so the protected layout and the
 * page it wraps share a single `getUser()` round trip. Per-request only (React
 * `cache`) — never a cross-request cache of session/RLS-bound data.
 */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The current user's profile. Request-memoized: the layout and every page in
 * the same render read it once. Built on the memoized `getAuthUser`, so it adds
 * at most one `profiles` query per request.
 */
export const getCurrentUser = cache(async (): Promise<Profile | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return profile ?? fallbackProfileFromAuthUser(user);
});

/** Insert public.profiles row if missing (e.g. trigger never ran). Required for FKs like communities.creator_id. */
export async function ensureProfileForAuthUser(
  user: User
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) return { ok: true };

  const fromMeta = (user.user_metadata?.username as string | undefined)?.trim();
  const fromEmail = user.email?.split("@")[0]?.trim();
  const raw = fromMeta || fromEmail || "user";
  let base = raw
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (base.length < 3) {
    base = `u_${user.id.replace(/-/g, "").slice(0, 12)}`;
  }
  base = base.slice(0, 30);

  for (let attempt = 0; attempt < 10; attempt++) {
    // nanoid's default alphabet includes '-', which the DB CHECK
    // profiles_username_format (00008) rejects; keep the fallback within
    // [a-zA-Z0-9_] so this collision path can't fail the constraint.
    const username =
      attempt === 0 ? base : `u_${nanoid(10).replace(/-/g, "_")}`.slice(0, 30);
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      username,
    });
    if (!error) return { ok: true };
    if (error.code !== "23505") {
      return { ok: false, error: mapSupabaseUserMessage(error.message) };
    }
  }

  return {
    ok: false,
    error:
      "Could not create your profile row. Open Settings and save your profile, or contact support.",
  };
}

export async function getFollowerCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", userId);
  return count ?? 0;
}

export async function getFollowingCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", userId);
  return count ?? 0;
}

export async function isFollowing(
  currentUserId: string,
  targetUserId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", currentUserId)
    .eq("following_id", targetUserId)
    .maybeSingle();
  return !!data;
}

// Follower/following lists are keyset-paginated on the join row's
// `(created_at, id)` (newest first). We select those ordering columns
// alongside the joined profile so the cursor keys on the follow, not the user.

export async function getFollowers(
  userId: string,
  cursor?: string | null
): Promise<Page<ProfileListItem>> {
  const supabase = await createClient();
  let query = supabase
    .from("follows")
    .select(
      "id, created_at, follower:profiles!follower_id(id, username, avatar_url, bio)"
    )
    .eq("following_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(FOLLOWS_PAGE_SIZE + 1);

  const decoded = decodeCursor(cursor);
  if (decoded) query = query.or(keysetFilter(decoded, "desc"));

  const { data } = await query;
  if (!data) return { items: [], nextCursor: null };

  const { pageRows, nextCursor } = pageFromRows(
    data,
    FOLLOWS_PAGE_SIZE,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({ created_at: r.created_at, id: r.id })
  );
  const items = pageRows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => r.follower)
    .filter(Boolean) as ProfileListItem[];
  return { items, nextCursor };
}

export async function getFollowingProfiles(
  userId: string,
  cursor?: string | null
): Promise<Page<ProfileListItem>> {
  const supabase = await createClient();
  let query = supabase
    .from("follows")
    .select(
      "id, created_at, following:profiles!following_id(id, username, avatar_url, bio)"
    )
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(FOLLOWS_PAGE_SIZE + 1);

  const decoded = decodeCursor(cursor);
  if (decoded) query = query.or(keysetFilter(decoded, "desc"));

  const { data } = await query;
  if (!data) return { items: [], nextCursor: null };

  const { pageRows, nextCursor } = pageFromRows(
    data,
    FOLLOWS_PAGE_SIZE,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({ created_at: r.created_at, id: r.id })
  );
  const items = pageRows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => r.following)
    .filter(Boolean) as ProfileListItem[];
  return { items, nextCursor };
}

/**
 * Which of `ids` the given user follows. Bounded by the page being rendered
 * (an `IN` over the visible profiles), so follow-state no longer requires
 * loading the caller's entire follow set.
 */
export async function getFollowedSubset(
  userId: string,
  ids: string[]
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId)
    .in("following_id", ids);
  return new Set((data ?? []).map((r) => r.following_id));
}

export async function getUserCommunities(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("community_members")
    .select("community_id, role, communities(id, name, slug)")
    .eq("user_id", userId);
  return data ?? [];
}
