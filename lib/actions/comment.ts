"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureProfileForAuthUser } from "@/lib/queries/profiles";
import { createCommentSchema } from "@/lib/validators/comment";
import { revalidatePath } from "next/cache";

export async function createComment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const ensured = await ensureProfileForAuthUser(user);
  if (!ensured.ok) return { error: ensured.error };

  const raw = {
    content: formData.get("content") as string,
    post_id: formData.get("post_id") as string,
  };

  const parsed = createCommentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      post_id: parsed.data.post_id,
      author_id: user.id,
      content: parsed.data.content,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const { data: post } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", parsed.data.post_id)
    .single();

  if (post && post.author_id !== user.id) {
    await supabase.from("notifications").insert({
      user_id: post.author_id,
      actor_id: user.id,
      type: "comment",
      post_id: parsed.data.post_id,
      comment_id: comment.id,
    });
  }

  revalidatePath(`/post/${parsed.data.post_id}`);
  return { success: true };
}

export async function deleteComment(commentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);

  if (error) return { error: error.message };

  revalidatePath("/home");
  return { success: true };
}
