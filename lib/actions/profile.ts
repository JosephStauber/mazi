"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureProfileForAuthUser } from "@/lib/queries/profiles";
import { updateProfileSchema } from "@/lib/validators/profile";
import { validateImageUpload } from "@/lib/utils/image";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const ensured = await ensureProfileForAuthUser(user);
  if (!ensured.ok) return { error: ensured.error };

  const raw: Record<string, string> = {};
  const username = formData.get("username") as string | null;
  const bio = formData.get("bio") as string | null;
  if (username) raw.username = username;
  if (bio !== null) raw.bio = bio;

  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const updates: Record<string, string> = {};
  if (parsed.data.username) updates.username = parsed.data.username;
  if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") return { error: "Username is already taken" };
    return { error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/settings");
  return { success: true };
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const ensured = await ensureProfileForAuthUser(user);
  if (!ensured.ok) return { error: ensured.error };

  const file = formData.get("avatar") as File;
  if (!file || file.size === 0) return { error: "No file provided" };
  if (file.size > 2 * 1024 * 1024) return { error: "File must be under 2MB" };

  const validated = validateImageUpload(file);
  if (!validated.ok) return { error: validated.error };
  const path = `${user.id}/avatar.${validated.value.ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      upsert: true,
      contentType: validated.value.contentType,
    });

  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/profile");
  revalidatePath("/settings");
  return { success: true, url: publicUrl };
}
