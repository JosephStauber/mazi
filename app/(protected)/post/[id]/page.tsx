"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useViewer } from "@/components/providers/viewer";
import { PostCard } from "@/components/post/post-card";
import { CommentList } from "@/components/comment/comment-list";
import { PageHeader } from "@/components/nav/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PostSkeleton } from "@/components/ui/skeleton";
import { CommentIcon } from "@/components/ui/icon";

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const currentUser = useViewer();
  const data = useQuery(api.posts.get, { postId: id });

  return (
    <div>
      <PageHeader title="Post" back />
      {data === undefined ? (
        <PostSkeleton />
      ) : data === null ? (
        <EmptyState
          icon={<CommentIcon size={24} />}
          title="Post not found"
          description="It may have been deleted, or you don't have access to it."
        />
      ) : (
        <>
          <PostCard
            post={data.post}
            currentUserId={currentUser.id}
            canModerate={data.can_moderate}
          />
          <CommentList
            postId={data.post.id}
            currentUser={currentUser}
            canModerate={data.can_moderate}
          />
        </>
      )}
    </div>
  );
}
