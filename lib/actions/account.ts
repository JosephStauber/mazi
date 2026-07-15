"use server";

import { createClient } from "@/lib/supabase/server";
import { mapSupabaseUserMessage } from "@/lib/supabase/map-error";
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

  const [
    profile,
    posts,
    comments,
    likes,
    following,
    followers,
    memberships,
    notifications,
    invitesSent,
    invitesReceived,
    communitiesCreated,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("posts").select("*").eq("author_id", id),
    supabase.from("comments").select("*").eq("author_id", id),
    supabase.from("likes").select("*").eq("user_id", id),
    supabase.from("follows").select("*").eq("follower_id", id),
    supabase.from("follows").select("*").eq("following_id", id),
    supabase.from("community_members").select("*").eq("user_id", id),
    supabase.from("notifications").select("*").eq("user_id", id),
    supabase.from("community_invites").select("*").eq("inviter_id", id),
    supabase.from("community_invites").select("*").eq("invitee_id", id),
    supabase.from("communities").select("*").eq("creator_id", id),
  ]);

  // A portability export must not silently drop rows: a failed query turned into
  // an empty array would misrepresent what we hold. Surface the first error.
  const failed = [
    profile,
    posts,
    comments,
    likes,
    following,
    followers,
    memberships,
    notifications,
    invitesSent,
    invitesReceived,
    communitiesCreated,
  ].find((r) => r.error);
  if (failed?.error) {
    return { error: mapSupabaseUserMessage(failed.error.message) };
  }

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
    notifications: notifications.data ?? [],
    invites_sent: invitesSent.data ?? [],
    invites_received: invitesReceived.data ?? [],
    communities_created: communitiesCreated.data ?? [],
  };

  return { success: true, data };
}
