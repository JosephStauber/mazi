"use client";

import Link from "next/link";
import Image from "next/image";
import { memo, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Modal } from "@/components/ui/modal";
import { RichText } from "@/components/ui/rich-text";
import { useToast } from "@/components/ui/toast";
import {
  HeartIcon,
  CommentIcon,
  ShareIcon,
  MoreIcon,
  EditIcon,
  TrashIcon,
} from "@/components/ui/icon";
import type { PostWithAuthor } from "@/lib/types/database";
import { toggleLike, deletePost, editPost } from "@/lib/actions/post";
import { formatRelative } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

interface PostCardProps {
  post: PostWithAuthor;
  currentUserId: string;
  canModerate?: boolean;
}

function PostCardImpl({ post, currentUserId, canModerate }: PostCardProps) {
  const { toast } = useToast();
  const [liked, setLiked] = useState(post.liked_by_user);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [likeAnim, setLikeAnim] = useState(false);
  const [burst, setBurst] = useState(false);

  const [content, setContent] = useState(post.content);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(post.content);
  const [savingEdit, setSavingEdit] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef(0);

  const isOwner = post.author_id === currentUserId;

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  function applyLike(next: boolean) {
    setLiked(next);
    setLikesCount((c) => c + (next ? 1 : -1));
    if (next) {
      setLikeAnim(true);
      setTimeout(() => setLikeAnim(false), 420);
    }
    const rollback = () => {
      setLiked(!next);
      setLikesCount((c) => c + (next ? -1 : 1));
      toast("Couldn't update like", "error");
    };
    toggleLike(post.id)
      .then((res) => {
        if (res?.error) rollback();
      })
      .catch(rollback);
  }

  function handleLike() {
    applyLike(!liked);
  }

  function likeFromImage() {
    if (!liked) applyLike(true);
    setBurst(true);
    setTimeout(() => setBurst(false), 850);
  }

  function handleImageActivate(e: React.MouseEvent) {
    // Keyboard activation reports detail 0 — like immediately. Pointer taps
    // keep the double-tap gesture so a single tap doesn't like accidentally.
    if (e.detail === 0) {
      likeFromImage();
      return;
    }
    const now = Date.now();
    if (now - lastTap.current < 300) {
      likeFromImage();
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ url, title: "Mazi post" });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied", "success");
    } catch {
      toast("Couldn't copy link", "error");
    }
  }

  async function saveEdit() {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    setSavingEdit(true);
    const result = await editPost(post.id, trimmed);
    setSavingEdit(false);
    if (result?.error) {
      toast(result.error, "error");
      return;
    }
    setContent(trimmed);
    setEditing(false);
    toast("Post updated", "success");
  }

  async function confirmDelete() {
    setDeleting(true);
    const result = await deletePost(post.id);
    setDeleting(false);
    if (result?.error) {
      toast(result.error, "error");
      return;
    }
    setConfirmOpen(false);
    setDeleted(true);
    toast("Post deleted", "success");
  }

  if (deleted) return null;

  return (
    <article className="px-4 py-4 transition-colors sm:px-5 [contain-intrinsic-size:auto_320px] [content-visibility:auto]">
      <div className="flex items-center gap-3">
        <Link href={`/profile/${post.author.username}`} className="shrink-0">
          <Avatar src={post.author.avatar_url} alt={post.author.username} size="sm" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5">
          <Link
            href={`/profile/${post.author.username}`}
            className="text-[15px] font-semibold text-foreground hover:underline"
          >
            {post.author.username}
          </Link>
          {post.community && (
            <Link
              href={`/communities/${post.community.slug}`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              in {post.community.name}
            </Link>
          )}
          <Link
            href={`/post/${post.id}`}
            className="text-xs text-subtle hover:text-foreground"
          >
            · {formatRelative(post.created_at)}
          </Link>
        </div>

        {(isOwner || canModerate) && (
          <div className="relative shrink-0" ref={menuRef}>
            <IconButton
              label="Post options"
              size="sm"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="text-muted-foreground"
            >
              <MoreIcon size={20} />
            </IconButton>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-1 min-w-[11rem] origin-top-right animate-scale-in overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface py-1 shadow-lg"
              >
                {isOwner && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setEditing(true);
                      setEditValue(content);
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                  >
                    <EditIcon size={17} /> Edit post
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-danger transition-colors hover:bg-muted"
                >
                  <TrashIcon size={17} /> Delete post
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-2.5 pl-0 sm:pl-[3.25rem]">
        {editing ? (
          <div className="space-y-2.5">
            <textarea
              autoFocus
              value={editValue}
              maxLength={2000}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full resize-none rounded-[var(--radius-md)] border border-border bg-surface px-3.5 py-2.5 text-[15px] leading-relaxed text-foreground focus-visible:border-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-foreground/5"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
                disabled={savingEdit}
              >
                Cancel
              </Button>
              <Button size="sm" loading={savingEdit} onClick={saveEdit}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          content && (
            <RichText text={content} className="text-[15px] leading-relaxed" />
          )
        )}

        {post.image_url && (
          <button
            type="button"
            onClick={handleImageActivate}
            aria-label={liked ? "Post liked" : "Like post"}
            className="relative mt-3 block max-h-[640px] w-full cursor-pointer overflow-hidden rounded-[var(--radius-md)] border border-border bg-muted"
          >
            <Image
              src={post.image_url}
              alt={content.slice(0, 80) || "Post image"}
              width={1080}
              height={1080}
              className="h-auto w-full object-cover"
            />
            {burst && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="animate-heart-burst text-white drop-shadow-lg">
                  <HeartIcon filled size={96} />
                </span>
              </span>
            )}
          </button>
        )}

        <div className="mt-3 flex items-center gap-1 text-muted-foreground">
          <button
            type="button"
            onClick={handleLike}
            aria-label={liked ? "Unlike" : "Like"}
            className={cn(
              "flex items-center gap-1.5 rounded-full py-1 pr-2.5 text-sm transition-colors",
              liked ? "text-danger" : "hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted",
                likeAnim && "animate-like-pop"
              )}
            >
              <HeartIcon filled={liked} size={22} />
            </span>
            {likesCount > 0 && (
              <span className="tabular-nums font-medium">{likesCount}</span>
            )}
          </button>

          <Link
            href={`/post/${post.id}`}
            aria-label="Comment"
            className="flex items-center gap-1.5 rounded-full py-1 pr-2.5 text-sm transition-colors hover:text-foreground"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted">
              <CommentIcon size={21} />
            </span>
            {post.comments_count > 0 && (
              <span className="tabular-nums font-medium">
                {post.comments_count}
              </span>
            )}
          </Link>

          <IconButton
            label="Share post"
            size="md"
            onClick={handleShare}
            className="text-muted-foreground hover:text-foreground"
          >
            <ShareIcon size={20} />
          </IconButton>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => !deleting && setConfirmOpen(false)}
        title="Delete post?"
        description="This can't be undone. The post and its comments will be permanently removed."
      >
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => setConfirmOpen(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button variant="danger" loading={deleting} onClick={confirmDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </article>
  );
}

/**
 * Memoized so growing a feed (each "load more" appends a page and re-renders the
 * list) doesn't re-render every already-mounted card — props are the post plus
 * two primitives, so a shallow compare is safe. Paired with `content-visibility`
 * on the article, off-screen cards in a long feed skip render/layout work too.
 */
export const PostCard = memo(PostCardImpl);
