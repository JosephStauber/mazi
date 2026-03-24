"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { PostWithAuthor } from "@/lib/types/database";
import { toggleLike } from "@/lib/actions/post";
import { deletePost } from "@/lib/actions/post";
import { formatRelative } from "@/lib/utils/date";

interface PostCardProps {
  post: PostWithAuthor;
  currentUserId: string;
  canModerate?: boolean;
}

export function PostCard({ post, currentUserId, canModerate }: PostCardProps) {
  const [liked, setLiked] = useState(post.liked_by_user);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const isOwner = post.author_id === currentUserId;

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!menuWrapRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  async function handleLike() {
    setLiked(!liked);
    setLikesCount(liked ? likesCount - 1 : likesCount + 1);
    await toggleLike(post.id);
  }

  function openDeleteDialog() {
    setMenuOpen(false);
    setDeleteError(null);
    deleteDialogRef.current?.showModal();
  }

  function closeDeleteDialog() {
    deleteDialogRef.current?.close();
    setDeleteError(null);
  }

  async function confirmDelete() {
    setDeleteError(null);
    setDeleting(true);
    const result = await deletePost(post.id);
    setDeleting(false);
    if (result?.error) {
      setDeleteError(result.error);
      return;
    }
    closeDeleteDialog();
  }

  return (
    <article className="border-b border-border bg-background last:border-b-0">
      <div className="flex items-center gap-3 px-0 py-3">
        <Link href={`/profile/${post.author.username}`} className="shrink-0">
          <Avatar
            src={post.author.avatar_url}
            alt={post.author.username}
            size="md"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link
              href={`/profile/${post.author.username}`}
              className="text-sm font-semibold text-foreground hover:opacity-70"
            >
              {post.author.username}
            </Link>
            {post.community && (
              <span className="text-xs text-muted-foreground">
                ·{" "}
                <Link
                  href={`/communities/${post.community.slug}`}
                  className="hover:opacity-70"
                >
                  {post.community.name}
                </Link>
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              · {formatRelative(post.created_at)}
            </span>
          </div>
        </div>
        {(isOwner || canModerate) && (
          <div className="relative shrink-0" ref={menuWrapRef}>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Post options"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MoreHorizontalIcon />
            </button>
            {menuOpen ? (
              <div
                className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] rounded-md border border-border bg-background py-1 shadow-md"
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-muted"
                  onClick={openDeleteDialog}
                >
                  Delete post
                </button>
              </div>
            ) : null}
            <dialog
              ref={deleteDialogRef}
              className="fixed left-1/2 top-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-5 shadow-lg backdrop:bg-black/50"
              onClose={() => setDeleting(false)}
            >
              <h2 className="text-lg font-semibold text-foreground">
                Delete post?
              </h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                This can’t be undone. The post and its comments will be removed.
              </p>
              {deleteError ? (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                  {deleteError}
                </p>
              ) : null}
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={closeDeleteDialog}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  loading={deleting}
                  onClick={confirmDelete}
                >
                  Delete
                </Button>
              </div>
            </dialog>
          </div>
        )}
      </div>

      {post.image_url && (
        <Link href={`/post/${post.id}`} className="block bg-black">
          <Image
            src={post.image_url}
            alt={post.content.slice(0, 80) || "Post image"}
            width={630}
            height={630}
            className="aspect-square w-full object-cover"
          />
        </Link>
      )}

      <div className="space-y-2 px-0 py-3">
        <Link href={`/post/${post.id}`} className="block text-sm">
          <span className="font-semibold text-foreground">
            {post.author.username}
          </span>{" "}
          <span className="whitespace-pre-wrap break-words text-foreground">
            {post.content}
          </span>
        </Link>

        {likesCount > 0 && (
          <p className="text-sm font-semibold text-foreground">
            {likesCount} {likesCount === 1 ? "like" : "likes"}
          </p>
        )}

        <div className="flex items-center gap-4 border-t border-border pt-3 mt-1">
          <button
            type="button"
            onClick={handleLike}
            className={`rounded-md p-1 transition-opacity touch-manipulation hover:opacity-70 ${
              liked ? "text-red-500" : "text-foreground"
            }`}
            aria-label={liked ? "Unlike" : "Like"}
          >
            <HeartIcon filled={liked} size={26} />
          </button>
          <Link
            href={`/post/${post.id}`}
            className="rounded-md p-1 text-foreground hover:opacity-70"
            aria-label="Comment"
          >
            <CommentIcon size={26} />
          </Link>
        </div>

        {post.comments_count > 0 && (
          <Link
            href={`/post/${post.id}`}
            className="block text-sm text-muted-foreground hover:text-foreground"
          >
            View all {post.comments_count} comments
          </Link>
        )}
      </div>
    </article>
  );
}

function HeartIcon({
  filled,
  size,
}: {
  filled: boolean;
  size: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MoreHorizontalIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </svg>
  );
}
