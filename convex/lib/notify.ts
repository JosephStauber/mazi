import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { extractMentions } from "../../lib/utils/mentions";
import { canViewPost } from "./access";

type NotificationInput = Omit<Doc<"notifications">, "_id" | "_creationTime" | "read">;

/**
 * Notifications are written only here, server-side, as part of the action that
 * caused them — clients can't insert them at all (this closes the whole
 * "spoofed notification" class the old RLS F11/00006/00009 rules guarded).
 * Never notifies the actor about their own action.
 */
export async function notify(ctx: MutationCtx, n: NotificationInput) {
  if (n.actorId && n.actorId === n.userId) return;
  await ctx.db.insert("notifications", { ...n, read: false });
}

/**
 * Notify users @mentioned in `content` — only those who can actually see the
 * post (so a mention in an invite-only community doesn't leak it), and not
 * anyone in `exclude` (already notified for this event).
 */
export async function notifyMentions(
  ctx: MutationCtx,
  {
    content,
    actor,
    post,
    commentId,
    exclude = [],
  }: {
    content: string;
    actor: Doc<"profiles">;
    post: Doc<"posts">;
    commentId?: Id<"comments">;
    exclude?: Id<"profiles">[];
  }
) {
  const skip = new Set<string>([actor._id, ...exclude]);
  for (const username of extractMentions(content).slice(0, 20)) {
    const target = await ctx.db
      .query("profiles")
      .withIndex("by_usernameLower", (q) => q.eq("usernameLower", username.toLowerCase()))
      .unique();
    if (!target || skip.has(target._id) || target.accessLevel !== "full") continue;
    if (!(await canViewPost(ctx, target, post))) continue;
    skip.add(target._id);
    await notify(ctx, {
      userId: target._id,
      actorId: actor._id,
      type: "mention",
      postId: post._id,
      commentId,
    });
  }
}
