"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CommentWithAuthor } from "@/lib/types/database";
import { createComment, deleteComment } from "@/lib/actions/comment";
import { formatRelative } from "@/lib/utils/date";

interface CommentListProps {
  comments: CommentWithAuthor[];
  postId: string;
  currentUserId: string;
  canModerate?: boolean;
}

export function CommentList({
  comments: initialComments,
  postId,
  currentUserId,
  canModerate,
}: CommentListProps) {
  const [comments, setComments] = useState(initialComments);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    formData.append("post_id", postId);
    await createComment(formData);
    formRef.current?.reset();
    setLoading(false);
  }

  async function handleDelete(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    await deleteComment(commentId);
  }

  return (
    <div className="space-y-4">
      <form ref={formRef} action={handleSubmit} className="space-y-2">
        <Textarea
          name="content"
          placeholder="Write a comment..."
          required
          maxLength={1000}
        />
        <Button type="submit" size="sm" loading={loading}>
          Comment
        </Button>
      </form>

      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-2.5">
            <Link href={`/profile/${comment.author.username}`}>
              <Avatar
                src={comment.author.avatar_url}
                alt={comment.author.username}
                size="sm"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href={`/profile/${comment.author.username}`}
                  className="text-sm font-semibold hover:underline"
                >
                  {comment.author.username}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {formatRelative(comment.created_at)}
                </span>
                {(comment.author_id === currentUserId || canModerate) && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="ml-auto text-xs text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="text-sm mt-0.5 break-words">{comment.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
