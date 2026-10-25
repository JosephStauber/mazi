import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { deny, requireOwner } from "./lib/access";
import { iso } from "./lib/dto";
import { audit, emailOf } from "./lib/moderation";
import { nullable } from "./lib/returns";
import { parseOrDeny } from "./lib/validate";
import { sendNotice } from "./email";
import { announcementSchema } from "../lib/validators/admin";

/**
 * The one-time launch email to everyone who reserved (verified addresses only).
 * Plain text through Resend — no tracking. It can be sent exactly once.
 */

const FOOTER =
  "You're getting this one-time email because you reserved a handle on Mazi. We don't send marketing email.";
const BATCH = 50;

function paragraphs(body: string) {
  return body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

export const status = query({
  args: {},
  returns: v.object({
    reserved: v.number(),
    launch: v.union(
      v.null(),
      v.object({
        subject: v.string(),
        status: v.union(v.literal("sending"), v.literal("sent")),
        recipients: v.number(),
        created_at: v.string(),
      })
    ),
    my_email: nullable(v.string()),
  }),
  handler: async (ctx) => {
    const me = await requireOwner(ctx);
    const [reservations, launch] = await Promise.all([
      ctx.db.query("reservations").take(10000),
      ctx.db.query("announcements").withIndex("by_kind", (q) => q.eq("kind", "launch")).first(),
    ]);
    return {
      reserved: reservations.length,
      launch: launch
        ? {
            subject: launch.subject,
            status: launch.status,
            recipients: launch.recipients,
            created_at: iso(launch._creationTime),
          }
        : null,
      my_email: await emailOf(ctx, me),
    };
  },
});

/** Preview: send the draft to the calling owner only. */
export const sendTest = mutation({
  args: { subject: v.string(), body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await requireOwner(ctx);
    const { subject, body } = parseOrDeny(announcementSchema, args);
    const to = await emailOf(ctx, me);
    if (!to) deny("Your account has no verified email");
    await sendNotice(ctx, { to, subject: `[Test] ${subject}`, paragraphs: paragraphs(body), footer: FOOTER });
    return null;
  },
});

export const sendLaunch = mutation({
  args: { subject: v.string(), body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const me = await requireOwner(ctx);
    const { subject, body } = parseOrDeny(announcementSchema, args);
    const existing = await ctx.db
      .query("announcements")
      .withIndex("by_kind", (q) => q.eq("kind", "launch"))
      .first();
    if (existing) deny("The launch email has already been sent");

    const id = await ctx.db.insert("announcements", {
      kind: "launch",
      subject,
      body,
      status: "sending",
      recipients: 0,
    });
    await audit(ctx, { actorId: me._id, action: "announcement_sent", details: `launch: ${subject}` });
    await ctx.scheduler.runAfter(0, internal.adminAnnouncements.sendBatch, {
      announcementId: id,
      cursor: null,
    });
    return null;
  },
});

/** Walks the reservations in batches so no transaction gets large. */
export const sendBatch = internalMutation({
  args: { announcementId: v.id("announcements"), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { announcementId, cursor }) => {
    const a = await ctx.db.get(announcementId);
    if (!a || a.status === "sent") return null;
    const page = await ctx.db
      .query("reservations")
      .paginate({ numItems: BATCH, cursor });
    let sent = 0;
    for (const r of page.page) {
      const p = await ctx.db.get(r.profileId);
      const to = p && (await emailOf(ctx, p));
      if (!to) continue;
      await sendNotice(ctx, { to, subject: a.subject, paragraphs: paragraphs(a.body), footer: FOOTER });
      sent++;
    }
    await ctx.db.patch(a._id, {
      recipients: a.recipients + sent,
      ...(page.isDone ? { status: "sent" as const } : {}),
    });
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.adminAnnouncements.sendBatch, {
        announcementId,
        cursor: page.continueCursor,
      });
    }
    return null;
  },
});
