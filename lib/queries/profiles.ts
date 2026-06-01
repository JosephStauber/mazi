import type { User } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { mapSupabaseUserMessage } from "@/lib/supabase/map-error";
import type { Profile } from "@/lib/types/database";

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

export async function getCurrentUser(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return profile ?? fallbackProfileFromAuthUser(user);
}

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
    const username =
      attempt === 0 ? base : `u_${nanoid(10)}`.slice(0, 30);
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

export async function getFollowers(userId: string): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("follower:profiles!follower_id(*)")
    .eq("following_id", userId)
    .order("created_at", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => r.follower).filter(Boolean) as Profile[];
}

export async function getFollowingProfiles(userId: string): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("following:profiles!following_id(*)")
    .eq("follower_id", userId)
    .order("created_at", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => r.following).filter(Boolean) as Profile[];
}

/** Set of user IDs the given user currently follows (for follow-state in lists). */
export async function getFollowingIdSet(userId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
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
