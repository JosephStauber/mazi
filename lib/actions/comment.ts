"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureProfileForAuthUser } from "@/lib/queries/profiles";
import { notifyMentions } from "@/lib/actions/mentions";
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

  const rawParent = (formData.get("parent_id") as string) || null;
  const raw = {
    content: formData.get("content") as string,
    post_id: formData.get("post_id") as string,
    parent_id: rawParent,
  };

  const parsed = createCommentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const insert: {
    post_id: string;
    author_id: string;
    content: string;
    parent_id?: string;
  } = {
    post_id: parsed.data.post_id,
    author_id: user.id,
    content: parsed.data.content,
  };
  if (parsed.data.parent_id) insert.parent_id = parsed.data.parent_id;

  const { data: comment, error } = await supabase
    .from("comments")
    .insert(insert)
    .select("id, created_at")
    .single();

  if (error) return { error: error.message };

  // The post author and (for replies) the parent-comment author are independent
  // reads — fetch them together instead of serially.
  const [{ data: post }, { data: parent }] = await Promise.all([
    supabase
      .from("posts")
      .select("author_id")
      .eq("id", parsed.data.post_id)
      .single(),
    parsed.data.parent_id
      ? supabase
          .from("comments")
          .select("author_id")
          .eq("id", parsed.data.parent_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // People already notified for this comment, so mentions don't double up.
  const notified = new Set<string>([user.id]);
  const recipients: string[] = [];
  if (post && post.author_id !== user.id) {
    notified.add(post.author_id);
    recipients.push(post.author_id);
  }
  // Notify the author of the comment being replied to (unless already notified).
  if (parent && !notified.has(parent.author_id)) {
    notified.add(parent.author_id);
    recipients.push(parent.author_id);
  }

  // Notification inserts stay best-effort (RLS-gated, errors swallowed) and now
  // run alongside the mention fan-out instead of one after another.
  await Promise.all([
    ...recipients.map((recipientId) =>
      supabase.from("notifications").insert({
        user_id: recipientId,
        actor_id: user.id,
        type: "comment",
        post_id: parsed.data.post_id,
        comment_id: comment.id,
      })
    ),
    notifyMentions(supabase, {
      content: parsed.data.content,
      actorId: user.id,
      postId: parsed.data.post_id,
      commentId: comment.id,
      excludeUserIds: [...notified],
    }),
  ]);

  revalidatePath(`/post/${parsed.data.post_id}`);
  // Return the persisted row so optimistic UI can swap its temporary item for a
  // real, editable/deletable/replyable comment without a full reload.
  return { success: true, comment };
}

export async function editComment(commentId: string, content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = content.trim();
  if (trimmed.length === 0) return { error: "Comment cannot be empty" };
  if (trimmed.length > 1000)
    return { error: "Comment must be at most 1000 characters" };

  const { error } = await supabase
    .from("comments")
    .update({ content: trimmed })
    .eq("id", commentId)
    .eq("author_id", user.id);

  if (error) return { error: error.message };
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
