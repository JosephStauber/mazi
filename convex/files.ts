import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { deny, requireFullAccess, requireViewer, requireVisiblePost } from "./lib/access";
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
    // what the file can be used for.
    await requireViewer(ctx);
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
  if (asAvatar || asPostImage) deny("That upload is already in use");
}

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
