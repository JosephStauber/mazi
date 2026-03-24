import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/queries/profiles";
import { getPost, getPostComments } from "@/lib/queries/posts";
import { PostCard } from "@/components/post/post-card";
import { CommentList } from "@/components/comment/comment-list";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const post = await getPost(id, currentUser.id);
  if (!post) notFound();

  const comments = await getPostComments(id);

  return (
    <div className="space-y-6">
      <PostCard post={post} currentUserId={currentUser.id} />
      <CommentList
        comments={comments}
        postId={id}
        currentUserId={currentUser.id}
      />
    </div>
  );
}
