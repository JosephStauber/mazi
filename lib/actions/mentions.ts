import type { SupabaseClient } from "@supabase/supabase-js";
import { extractMentions } from "@/lib/utils/mentions";

interface NotifyMentionsOptions {
  content: string;
  actorId: string;
  postId: string;
  commentId?: string | null;
  /** User IDs that already received a notification for this event. */
  excludeUserIds?: string[];
}

/**
 * Best-effort: notify users @mentioned in `content`. Failures are swallowed
 * (e.g. if the 'mention' notification type hasn't been migrated yet) so the
 * parent post/comment still succeeds.
 */
export async function notifyMentions(
  supabase: SupabaseClient,
  { content, actorId, postId, commentId, excludeUserIds = [] }: NotifyMentionsOptions
): Promise<void> {
  try {
    const usernames = extractMentions(content);
    if (usernames.length === 0) return;

    const { data: users } = await supabase
      .from("profiles")
      .select("id")
      .in("username", usernames);
    if (!users?.length) return;

    const exclude = new Set([actorId, ...excludeUserIds]);
    const rows = users
      .filter((u) => !exclude.has(u.id))
      .map((u) => ({
        user_id: u.id,
        actor_id: actorId,
        type: "mention",
        post_id: postId,
        comment_id: commentId ?? null,
      }));
    if (rows.length === 0) return;

    await supabase.from("notifications").insert(rows);
  } catch {
    // Best-effort: never let mention notifications fail the parent post/comment.
  }
}
