"use server";

import { createClient } from "@/lib/supabase/server";
import { legal } from "@/lib/legal/config";

/**
 * Right to access / portability (GDPR Art. 15 & 20): return everything we hold
 * about the signed-in user as a portable JSON object. RLS limits each query to
 * the caller's own rows.
 */
export async function exportMyData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = user.id;

  const [profile, posts, comments, likes, following, followers, memberships] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("posts").select("*").eq("author_id", id),
      supabase.from("comments").select("*").eq("author_id", id),
      supabase.from("likes").select("*").eq("user_id", id),
      supabase.from("follows").select("*").eq("follower_id", id),
      supabase.from("follows").select("*").eq("following_id", id),
      supabase.from("community_members").select("*").eq("user_id", id),
    ]);

  const data = {
    export: {
      service: legal.appName,
      generated_at: new Date().toISOString(),
      format: "GDPR data portability export (JSON)",
    },
    account: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    profile: profile.data ?? null,
    posts: posts.data ?? [],
    comments: comments.data ?? [],
    likes: likes.data ?? [],
    following: following.data ?? [],
    followers: followers.data ?? [],
    community_memberships: memberships.data ?? [],
  };

  return { success: true, data };
}
