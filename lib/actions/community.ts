"use server";

import { createClient } from "@/lib/supabase/server";
import { mapSupabaseUserMessage } from "@/lib/supabase/map-error";
import { ensureProfileForAuthUser } from "@/lib/queries/profiles";
import {
  createCommunitySchema,
  updateCommunitySchema,
} from "@/lib/validators/community";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createCommunity(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const ensured = await ensureProfileForAuthUser(user);
  if (!ensured.ok) return { error: ensured.error };

  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    privacy_type: formData.get("privacy_type") as "public" | "invite_only",
  };

  const parsed = createCommunitySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const slug = slugify(parsed.data.name) + "-" + nanoid(6);

  const { data: community, error } = await supabase
    .from("communities")
    .insert({
      name: parsed.data.name,
      slug,
      description: parsed.data.description || null,
      creator_id: user.id,
      privacy_type: parsed.data.privacy_type,
    })
    .select("id, slug")
    .single();

  if (error) return { error: mapSupabaseUserMessage(error.message) };

  const { error: memberError } = await supabase
    .from("community_members")
    .insert({
      community_id: community.id,
      user_id: user.id,
      role: "creator",
    });

  if (memberError) {
    await supabase.from("communities").delete().eq("id", community.id);
    return { error: mapSupabaseUserMessage(memberError.message) };
  }

  revalidatePath("/communities");
  redirect(`/communities/${community.slug}`);
}

export async function updateCommunity(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const communityId = formData.get("community_id") as string;
  if (!communityId) return { error: "Missing community" };

  const { data: row } = await supabase
    .from("communities")
    .select("id, creator_id, slug")
    .eq("id", communityId)
    .maybeSingle();

  if (!row || row.creator_id !== user.id) {
    return { error: "Only the community creator can edit it" };
  }

  const raw = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    privacy_type: formData.get("privacy_type") as "public" | "invite_only",
  };

  const parsed = updateCommunitySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("communities")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      privacy_type: parsed.data.privacy_type,
    })
    .eq("id", communityId);

  if (error) return { error: mapSupabaseUserMessage(error.message) };

  revalidatePath("/communities");
  revalidatePath(`/communities/${row.slug}`);
  return { success: true };
}

export async function deleteCommunity(communityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: row } = await supabase
    .from("communities")
    .select("id, creator_id, slug")
    .eq("id", communityId)
    .maybeSingle();

  if (!row || row.creator_id !== user.id) {
    return { error: "Only the community creator can delete it" };
  }

  const { error } = await supabase
    .from("communities")
    .delete()
    .eq("id", communityId);

  if (error) return { error: mapSupabaseUserMessage(error.message) };

  revalidatePath("/communities");
  return { success: true };
}

export async function joinCommunity(communityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const ensured = await ensureProfileForAuthUser(user);
  if (!ensured.ok) return { error: ensured.error };

  const { error } = await supabase.from("community_members").insert({
    community_id: communityId,
    user_id: user.id,
    role: "member",
  });

  if (error) {
    if (error.code === "23505") return { error: "Already a member" };
    return { error: mapSupabaseUserMessage(error.message) };
  }

  revalidatePath("/communities");
  return { success: true };
}

export async function leaveCommunity(communityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", user.id);

  if (error) return { error: mapSupabaseUserMessage(error.message) };

  revalidatePath("/communities");
  return { success: true };
}

export async function inviteByUsername(
  communityId: string,
  username: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const ensured = await ensureProfileForAuthUser(user);
  if (!ensured.ok) return { error: ensured.error };

  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (!target) return { error: "User not found" };

  const { data: alreadyMember } = await supabase
    .from("community_members")
    .select("id")
    .eq("community_id", communityId)
    .eq("user_id", target.id)
    .maybeSingle();

  if (alreadyMember) return { error: "User is already a member" };

  const { error } = await supabase.from("community_invites").insert({
    community_id: communityId,
    inviter_id: user.id,
    invitee_id: target.id,
    status: "pending",
  });

  if (error) return { error: mapSupabaseUserMessage(error.message) };

  await supabase.from("notifications").insert({
    user_id: target.id,
    actor_id: user.id,
    type: "community_invite",
    community_id: communityId,
  });

  return { success: true };
}

export async function generateInviteLink(communityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const ensured = await ensureProfileForAuthUser(user);
  if (!ensured.ok) return { error: ensured.error };

  const token = nanoid(24);

  const { error } = await supabase.from("community_invites").insert({
    community_id: communityId,
    inviter_id: user.id,
    token,
    status: "pending",
  });

  if (error) return { error: mapSupabaseUserMessage(error.message) };

  const url = `${process.env.NEXT_PUBLIC_APP_URL}/communities/join?token=${token}`;
  return { success: true, url };
}

export async function acceptInvite(inviteId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const ensured = await ensureProfileForAuthUser(user);
  if (!ensured.ok) return { error: ensured.error };

  // Acceptance happens inside a SECURITY DEFINER RPC: it validates the
  // invite (status/expiry/targeted-invitee), stamps the invitee, and inserts
  // membership atomically — bypassing the locked-down invites RLS safely.
  const { data: communityId, error } = await supabase.rpc("accept_invite", {
    p_invite_id: inviteId,
  });

  if (error) return { error: mapSupabaseUserMessage(error.message) };

  revalidatePath("/communities");
  return { success: true, communityId };
}

export async function declineInvite(inviteId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("community_invites")
    .update({ status: "declined" })
    .eq("id", inviteId);

  if (error) return { error: mapSupabaseUserMessage(error.message) };

  revalidatePath("/notifications");
  return { success: true };
}

export async function resolveInviteToken(token: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Invite rows are no longer world-readable; resolve the shareable link via a
  // SECURITY DEFINER RPC that returns only the public-facing community fields
  // (and only for pending, unexpired invites).
  const { data: rows, error } = await supabase.rpc("get_invite_by_token", {
    p_token: token,
  });

  if (error) return { error: mapSupabaseUserMessage(error.message) };

  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) return { error: "Invite not found or already used" };

  // Reshape the flat RPC columns into the nested shape the join page expects.
  const invite = {
    id: row.id as string,
    community_id: row.community_id as string,
    communities: {
      id: row.community_id as string,
      name: row.community_name as string,
      slug: row.community_slug as string,
      description: row.community_description as string | null,
    },
  };

  return { success: true, invite };
}
