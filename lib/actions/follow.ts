"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureProfileForAuthUser } from "@/lib/queries/profiles";
import { revalidatePath } from "next/cache";

export async function toggleFollow(targetUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (user.id === targetUserId) return { error: "Cannot follow yourself" };

  const ensured = await ensureProfileForAuthUser(user);
  if (!ensured.ok) return { error: ensured.error };

  const { data: existing } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();

  if (existing) {
    await supabase.from("follows").delete().eq("id", existing.id);
  } else {
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: user.id, following_id: targetUserId });
    if (error) return { error: error.message };

    await supabase.from("notifications").insert({
      user_id: targetUserId,
      actor_id: user.id,
      type: "follow",
    });
  }

  revalidatePath("/profile");
  revalidatePath("/home");
  return { success: true, following: !existing };
}
