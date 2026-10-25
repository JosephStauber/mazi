import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { deny, requireFullAccess, requireViewer, requireVisiblePost } from "./lib/access";
import { enforceRateLimit } from "./lib/rateLimit";
import { IMAGE_TYPES } from "./lib/validate";

/**
 * Uploads: the client asks for a one-time upload URL, POSTs the file to it,
 * then passes the returned storage id to `posts:create` or
 * `profiles:setAvatar`, which call `claimImage` to validate it.
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    // Reserved accounts may upload (avatar) — the claiming mutation decides
    // what the file can be used for. Rate-limited per account; files that are
    // never claimed are deleted by `files:sweepOrphanedUploads` (crons.ts).
    const viewer = await requireViewer(ctx);
    await enforceRateLimit(ctx, "upload", viewer._id);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Validate a freshly uploaded file before attaching it: it must be an allowed
 * raster image under `maxBytes`, and not already attached to anything (so a
 * storage id seen in someone's avatar URL can't be re-used). Rejected files are
 * deleted.
 */
export async function claimImage(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  maxBytes: number
) {
  const meta = await ctx.db.system.get(storageId);
  if (!meta) deny("Upload not found — try again");
  const ok = !!meta.contentType && IMAGE_TYPES.has(meta.contentType) && meta.size <= maxBytes;
  if (!ok) {
    await ctx.storage.delete(storageId);
    deny(
      meta.size > maxBytes
        ? `Image must be under ${Math.round(maxBytes / (1024 * 1024))}MB`
        : "Unsupported file type. Use JPEG, PNG, WebP, or GIF."
    );
  }
  if (await isAttached(ctx, storageId)) deny("That upload is already in use");
}

/** Whether a stored file is in use as an avatar or a post image. */
async function isAttached(ctx: QueryCtx, storageId: Id<"_storage">) {
  const [asAvatar, asPostImage] = await Promise.all([
    ctx.db
      .query("profiles")
      .withIndex("by_avatar", (q) => q.eq("avatarId", storageId))
      .first(),
    ctx.db
      .query("posts")
      .withIndex("by_image", (q) => q.eq("imageId", storageId))
      .first(),
  ]);
  return asAvatar !== null || asPostImage !== null;
}

const SWEEP_KEY = "uploadSweep";
const SWEEP_BATCH = 200;
/** How long an upload may sit unattached (composer open, claim in flight). */
const ORPHAN_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Delete uploads that were never attached to a profile or post. Runs hourly
 * (crons.ts). Walks `_storage` in creation order from a saved cursor, so each
 * file is checked once, after it's a day old; continues itself in batches.
 */
export const sweepOrphanedUploads = internalMutation({
  args: {},
  returns: v.object({ checked: v.number(), deleted: v.number() }),
  handler: async (ctx) => {
    const state = await ctx.db
      .query("jobState")
      .withIndex("by_key", (q) => q.eq("key", SWEEP_KEY))
      .unique();
    const cursor = state?.cursor ?? 0;
    const cutoff = Date.now() - ORPHAN_AFTER_MS;
    const files = await ctx.db.system
      .query("_storage")
      .withIndex("by_creation_time", (q) =>
        q.gt("_creationTime", cursor).lt("_creationTime", cutoff)
      )
      .take(SWEEP_BATCH);

    let deleted = 0;
    for (const f of files) {
      if (await isAttached(ctx, f._id)) continue;
      await ctx.storage.delete(f._id);
      deleted++;
    }

    if (files.length > 0) {
      const next = files[files.length - 1]._creationTime;
      if (state) await ctx.db.patch(state._id, { cursor: next });
      else await ctx.db.insert("jobState", { key: SWEEP_KEY, cursor: next });
    }
    if (files.length === SWEEP_BATCH) {
      await ctx.scheduler.runAfter(0, internal.files.sweepOrphanedUploads, {});
    }
    return { checked: files.length, deleted };
  },
});

/**
 * Backs `/api/images/[postId]`: returns the storage URL only if the caller can
 * see the post. The Next.js route streams the bytes, so the raw storage URL
 * never reaches the browser.
 */
export const postImageUrl = query({
  args: { postId: v.id("posts") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { postId }) => {
    const viewer = await requireFullAccess(ctx);
    const post = await requireVisiblePost(ctx, viewer, postId);
    return post.imageId ? await ctx.storage.getUrl(post.imageId) : null;
  },
});
