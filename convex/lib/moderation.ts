import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { components } from "../_generated/api";
import { authComponent } from "../auth";
import { sendNotice } from "../email";
import { legal } from "../../lib/legal/config";

/**
 * Shared moderation steps. Every privileged change goes through `audit` in the
 * same mutation, so the log can't miss an action that committed.
 */

export async function audit(
  ctx: MutationCtx,
  row: {
    actorId?: Id<"profiles">;
    action: Doc<"adminActions">["action"];
    target?: Doc<"profiles">;
    reason?: string;
    details?: string;
  }
) {
  await ctx.db.insert("adminActions", {
    actorId: row.actorId,
    action: row.action,
    targetId: row.target?._id,
    targetUsername: row.target?.username,
    reason: row.reason,
    details: row.details,
  });
}

/** The account's verified email, or null. Server-only — never return it to a client. */
export async function emailOf(ctx: QueryCtx, p: Doc<"profiles">): Promise<string | null> {
  const user = await authComponent.getAnyUserById(ctx, p.authUserId);
  return user?.emailVerified ? user.email : null;
}

/** Sign the account out everywhere (delete its Better Auth sessions). */
export async function revokeSessions(ctx: MutationCtx, authUserId: string) {
  let cursor: string | null = null;
  for (;;) {
    const result: { isDone: boolean; continueCursor: string } = await ctx.runMutation(
      components.betterAuth.adapter.deleteMany,
      {
        input: { model: "session", where: [{ field: "userId", value: authUserId }] },
        paginationOpts: { numItems: 100, cursor },
      }
    );
    if (result.isDone) return;
    cursor = result.continueCursor;
  }
}

const appUrl = () => process.env.SITE_URL ?? "";
const appealsFooter = () =>
  `Questions? Reply to ${legal.contactEmail}. This is a service message about your Mazi account.`;

export async function notifyByEmail(
  ctx: MutationCtx,
  p: Doc<"profiles">,
  subject: string,
  paragraphs: string[]
) {
  const to = await emailOf(ctx, p);
  if (to) await sendNotice(ctx, { to, subject, paragraphs, footer: appealsFooter() });
}

/** Suspend, sign out everywhere, email the statement of reasons, and audit. */
export async function suspendProfile(
  ctx: MutationCtx,
  {
    target,
    actorId,
    reason,
    until,
    durationLabel,
  }: {
    target: Doc<"profiles">;
    actorId: Id<"profiles">;
    reason: string;
    until: number | null;
    durationLabel: string;
  }
) {
  await ctx.db.patch(target._id, {
    suspendedAt: Date.now(),
    suspendedReason: reason,
    suspendedUntil: until ?? undefined,
  });
  await revokeSessions(ctx, target.authUserId);
  await notifyByEmail(ctx, target, "Your Mazi account has been suspended", [
    `Hi @${target.username},`,
    until
      ? `Your account is suspended until ${new Date(until).toUTCString()}.`
      : "Your account is suspended until our team restores it.",
    `Reason: ${reason}`,
    `You can sign in at ${appUrl()}/suspended to read this notice, appeal the decision, or download your data.`,
  ]);
  await audit(ctx, {
    actorId,
    action: "suspend",
    target,
    reason,
    details: durationLabel,
  });
}

/** Lift a suspension (by an admin, an accepted appeal, or expiry) and tell the user. */
export async function liftSuspension(
  ctx: MutationCtx,
  {
    target,
    actorId,
    via,
    note,
  }: {
    target: Doc<"profiles">;
    actorId?: Id<"profiles">;
    via: "admin" | "appeal" | "expired";
    /** Optional reply from the team, included in the email. */
    note?: string;
  }
) {
  await ctx.db.patch(target._id, {
    suspendedAt: undefined,
    suspendedReason: undefined,
    suspendedUntil: undefined,
  });
  await notifyByEmail(ctx, target, "Your Mazi account has been restored", [
    `Hi @${target.username},`,
    via === "expired"
      ? "Your suspension has ended and your account is active again."
      : via === "appeal"
        ? "We reviewed your appeal and restored your account."
        : "Our team has restored your account. It's active again.",
    ...(note ? [`From our team: ${note}`] : []),
    `Sign in at ${appUrl()}/login.`,
  ]);
  // Appeal acceptance writes its own audit row.
  if (via !== "appeal") {
    await audit(ctx, {
      actorId,
      action: "unsuspend",
      target,
      details: via === "expired" ? "suspension expired" : undefined,
    });
  }
}
