"use server";

import { createClient } from "@/lib/supabase/server";
import { mapSupabaseUserMessage } from "@/lib/supabase/map-error";
import { ensureProfileForAuthUser } from "@/lib/queries/profiles";
import { notifyMentions } from "@/lib/actions/mentions";
import { createPostSchema } from "@/lib/validators/post";
import { validateImageUpload } from "@/lib/utils/image";
import { revalidatePath } from "next/cache";

export async function createPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const ensured = await ensureProfileForAuthUser(user);
  if (!ensured.ok) return { error: ensured.error };

  const raw = {
    content: formData.get("content") as string,
    community_id: (formData.get("community_id") as string) || null,
  };

  const parsed = createPostSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  let image_url: string | null = null;
  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) {
    if (imageFile.size > 5 * 1024 * 1024)
      return { error: "Image must be under 5MB" };
    const validated = validateImageUpload(imageFile);
    if (!validated.ok) return { error: validated.error };
    const path = `${user.id}/${crypto.randomUUID()}.${validated.value.ext}`;
    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(path, imageFile, { contentType: validated.value.contentType });
    if (uploadError)
      return { error: mapSupabaseUserMessage(uploadError.message) };
    const {
      data: { publicUrl },
    } = supabase.storage.from("post-images").getPublicUrl(path);
    image_url = publicUrl;
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      content: parsed.data.content,
      image_url,
      community_id: parsed.data.community_id || null,
    })
    .select("id")
    .single();

  if (error) return { error: mapSupabaseUserMessage(error.message) };

  await notifyMentions(supabase, {
    content: parsed.data.content,
    actorId: user.id,
    postId: post.id,
  });

  revalidatePath("/home");
  // The author's profile feed is a separate route; without this the Next.js
  // router cache serves a stale profile and the new post shows up only after
  // the cache expires.
  revalidatePath("/profile/[username]", "page");
  if (parsed.data.community_id) {
    revalidatePath("/communities");
    const { data: comm } = await supabase
      .from("communities")
      .select("slug")
      .eq("id", parsed.data.community_id)
      .single();
    if (comm?.slug) revalidatePath(`/communities/${comm.slug}`);
  }
  return { success: true };
}

export async function editPost(postId: string, content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = createPostSchema.safeParse({ content });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("posts")
    .update({ content: parsed.data.content })
    .eq("id", postId)
    .eq("author_id", user.id);

  if (error) return { error: mapSupabaseUserMessage(error.message) };

  revalidatePath("/home");
  revalidatePath(`/post/${postId}`);
  revalidatePath("/profile/[username]", "page");
  return { success: true };
}

export async function deletePost(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("posts").delete().eq("id", postId);

  if (error) return { error: mapSupabaseUserMessage(error.message) };

  revalidatePath("/home");
  revalidatePath("/profile/[username]", "page");
  return { success: true };
}

export async function toggleLike(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const ensured = await ensureProfileForAuthUser(user);
  if (!ensured.ok) return { error: ensured.error };

  const { data: existing } = await supabase
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    await supabase.from("likes").delete().eq("id", existing.id);
  } else {
    const { error } = await supabase
      .from("likes")
      .insert({ post_id: postId, user_id: user.id });
    if (error) return { error: mapSupabaseUserMessage(error.message) };

    const { data: post } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", postId)
      .single();

    if (post && post.author_id !== user.id) {
      await supabase.from("notifications").insert({
        user_id: post.author_id,
        actor_id: user.id,
        type: "like",
        post_id: postId,
      });
    }
  }

  revalidatePath("/home");
  return { success: true, liked: !existing };
}
