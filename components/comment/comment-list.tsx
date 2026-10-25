"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { EmptyState } from "@/components/ui/empty-state";
import { RichText } from "@/components/ui/rich-text";
import { MentionTextarea } from "@/components/ui/mention-textarea";
import { useToast } from "@/components/ui/toast";
import { CommentIcon, MoreIcon, EditIcon, TrashIcon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import type { CommentWithAuthor, Profile } from "@/lib/types/database";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { formatRelative } from "@/lib/utils/date";
import { errorMessage } from "@/lib/utils/errors";

interface CommentListProps {
  postId: string;
  currentUser: Profile;
  canModerate?: boolean;
}

function rootIdOf(
  comment: CommentWithAuthor,
  byId: Map<string, CommentWithAuthor>
): string {
  let cur = comment;
  const seen = new Set<string>();
  while (cur.parent_id && byId.has(cur.parent_id) && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = byId.get(cur.parent_id)!;
  }
  return cur.id;
}

export function CommentList({
  postId,
  currentUser,
  canModerate,
}: CommentListProps) {
  const { toast } = useToast();
  // Live: comments from other people appear as they're posted. Pages are by
  // root comment and carry their replies (convex/comments.ts).
  const list = usePaginatedList(
    api.comments.list,
    { postId: postId as Id<"posts"> },
    10
  );
  const comments = list.items;
  const createComment = useMutation(api.comments.create);
  const deleteComment = useMutation(api.comments.remove);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const { roots, repliesByRoot } = useMemo(() => {
    const byId = new Map(comments.map((c) => [c.id, c]));
    const roots: CommentWithAuthor[] = [];
    const repliesByRoot = new Map<string, CommentWithAuthor[]>();
    for (const c of comments) {
      const root = rootIdOf(c, byId);
      if (root === c.id) {
        roots.push(c);
      } else {
        const list = repliesByRoot.get(root) ?? [];
        list.push(c);
        repliesByRoot.set(root, list);
      }
    }
    const byTime = (a: CommentWithAuthor, b: CommentWithAuthor) =>
      a.created_at.localeCompare(b.created_at);
    roots.sort(byTime);
    repliesByRoot.forEach((list) => list.sort(byTime));
    return { roots, repliesByRoot };
  }, [comments]);

  function grow() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  async function submitTopLevel() {
    const content = value.trim();
    if (!content) return;
    setLoading(true);
    setValue("");
    if (taRef.current) taRef.current.style.height = "auto";
    try {
      await createComment({ postId: postId as Id<"posts">, content });
    } catch (e) {
      setValue(content);
      toast(errorMessage(e), "error");
    } finally {
      setLoading(false);
    }
  }

  async function addReply(rootId: string, content: string): Promise<boolean> {
    try {
      await createComment({
        postId: postId as Id<"posts">,
        content,
        parentId: rootId as Id<"comments">,
      });
      return true;
    } catch (e) {
      toast(errorMessage(e), "error");
      return false;
    }
  }

  function onDelete(id: string) {
    deleteComment({ commentId: id as Id<"comments"> }).then(
      () => toast("Comment deleted", "success"),
      (e) => toast(errorMessage(e), "error")
    );
  }

  return (
    <div>
      <div className="border-t border-border" />

      <form
        action={submitTopLevel}
        className="flex items-end gap-2.5 border-b border-border py-4"
      >
        <Avatar src={currentUser.avatar_url} alt={currentUser.username} size="sm" />
        <MentionTextarea
          ref={taRef}
          value={value}
          onChange={(v) => {
            setValue(v.slice(0, 1000));
            grow();
          }}
          onInput={grow}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submitTopLevel();
            }
          }}
          placeholder="Add a comment..."
          rows={1}
          maxLength={1000}
          className="min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-relaxed text-foreground placeholder:text-subtle focus:outline-none"
        />
        <Button type="submit" size="sm" loading={loading} disabled={!value.trim()}>
          Post
        </Button>
      </form>

      {list.firstLoad ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Spinner />
        </div>
      ) : roots.length === 0 ? (
        <EmptyState
          icon={<CommentIcon size={24} />}
          title="No comments yet"
          description="Be the first to share what you think."
        />
      ) : (
        <ul className="divide-y divide-border">
          {roots.map((root) => (
            <li key={root.id} className="py-1">
              <CommentThread
                root={root}
                replies={repliesByRoot.get(root.id) ?? []}
                currentUser={currentUser}
                canModerate={!!canModerate}
                onDelete={onDelete}
                onReply={addReply}
              />
            </li>
          ))}
        </ul>
      )}

      {!list.firstLoad && !list.done && (
        <div className="flex justify-center py-4">
          <Button
            variant="ghost"
            size="sm"
            loading={list.loading}
            onClick={list.loadMore}
          >
            Load more comments
          </Button>
        </div>
      )}
    </div>
  );
}

function CommentThread({
  root,
  replies,
  currentUser,
  canModerate,
  onDelete,
  onReply,
}: {
  root: CommentWithAuthor;
  replies: CommentWithAuthor[];
  currentUser: Profile;
  canModerate: boolean;
  onDelete: (id: string) => void;
  onReply: (rootId: string, content: string) => Promise<boolean>;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  function openReply(username: string) {
    setDraft(username === currentUser.username ? "" : `@${username} `);
    setReplyOpen(true);
    requestAnimationFrame(() => {
      const el = replyRef.current;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
  }

  async function sendReply() {
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    const ok = await onReply(root.id, content);
    setSending(false);
    if (ok) {
      setDraft("");
      setReplyOpen(false);
    }
  }

  return (
    <div>
      <CommentRow
        comment={root}
        canDelete={root.author_id === currentUser.id || canModerate}
        canEdit={root.author_id === currentUser.id}
        onDelete={() => onDelete(root.id)}
        onReply={() => openReply(root.author.username)}
      />

      {(replies.length > 0 || replyOpen) && (
        <div className="ml-11 space-y-1 border-l border-border pl-3">
          {replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              canDelete={reply.author_id === currentUser.id || canModerate}
              canEdit={reply.author_id === currentUser.id}
              onDelete={() => onDelete(reply.id)}
              onReply={() => openReply(reply.author.username)}
              compact
            />
          ))}

          {replyOpen && (
            <div className="flex items-end gap-2 py-2">
              <Avatar
                src={currentUser.avatar_url}
                alt={currentUser.username}
                size="xs"
              />
              <MentionTextarea
                ref={replyRef}
                value={draft}
                onChange={(v) => setDraft(v.slice(0, 1000))}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    sendReply();
                  }
                  if (e.key === "Escape") setReplyOpen(false);
                }}
                placeholder="Write a reply..."
                rows={1}
                maxLength={1000}
                autoFocus
                className="min-h-8 flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed text-foreground placeholder:text-subtle focus:outline-none"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setReplyOpen(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={sendReply}
                loading={sending}
                disabled={!draft.trim()}
              >
                Reply
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  canDelete,
  canEdit,
  onDelete,
  onReply,
  compact,
}: {
  comment: CommentWithAuthor;
  canDelete: boolean;
  canEdit: boolean;
  onDelete: () => void;
  onReply: () => void;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const editComment = useMutation(api.comments.edit);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await editComment({ commentId: comment.id as Id<"comments">, content: trimmed });
      setEditing(false);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  }

  const avatarSize = compact ? "xs" : "sm";

  return (
    <div className="group flex gap-2.5 py-3">
      <Link href={`/profile/${comment.author.username}`} className="shrink-0">
        <Avatar
          src={comment.author.avatar_url}
          alt={comment.author.username}
          size={avatarSize}
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/profile/${comment.author.username}`}
            className="text-sm font-semibold text-foreground hover:underline"
          >
            {comment.author.username}
          </Link>
          <span className="text-xs text-subtle">
            {formatRelative(comment.created_at)}
          </span>
          {(canDelete || canEdit) && !editing && (
            <div className="relative ml-auto">
              <IconButton
                label="Comment options"
                size="sm"
                onClick={() => setMenuOpen((o) => !o)}
                className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 data-[open=true]:opacity-100"
                data-open={menuOpen}
              >
                <MoreIcon size={18} />
              </IconButton>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full z-30 mt-1 min-w-[9rem] origin-top-right animate-scale-in overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface py-1 shadow-lg"
                  role="menu"
                >
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setEditing(true);
                        setDraft(comment.content);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                    >
                      <EditIcon size={16} /> Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-danger hover:bg-muted"
                  >
                    <TrashIcon size={16} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="mt-1.5 space-y-2">
            <MentionTextarea
              autoFocus
              value={draft}
              maxLength={1000}
              onChange={(v) => setDraft(v)}
              rows={2}
              className="w-full resize-none rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm leading-relaxed text-foreground focus-visible:border-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-foreground/5"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" loading={saving} onClick={save}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            <RichText
              text={comment.content}
              className="mt-0.5 text-[15px] leading-relaxed"
            />
            <button
              type="button"
              onClick={onReply}
              className="mt-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Reply
            </button>
          </>
        )}
      </div>
    </div>
  );
}
