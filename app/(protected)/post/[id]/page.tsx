import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/queries/profiles";
import { getPost, getPostComments } from "@/lib/queries/posts";
import { loadMoreComments } from "@/lib/actions/pagination";
import { PostCard } from "@/components/post/post-card";
import { CommentList } from "@/components/comment/comment-list";
import { PageHeader } from "@/components/nav/page-header";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  // The post (personalized: needs the viewer for `liked_by_user`) and its first
  // page of comments are independent — load them together.
  const [post, commentsPage] = await Promise.all([
    getPost(id, currentUser.id),
    getPostComments(id),
  ]);
  if (!post) notFound();

  let canModerate = false;
  if (post.community_id) {
    const supabase = await createClient();
    const { data: membership } = await supabase
      .from("community_members")
      .select("role")
      .eq("community_id", post.community_id)
      .eq("user_id", currentUser.id)
      .maybeSingle();
    canModerate =
      membership?.role === "moderator" || membership?.role === "creator";
  }

  return (
    <div>
      <PageHeader title="Post" back />
      <PostCard post={post} currentUserId={currentUser.id} canModerate={canModerate} />
      <CommentList
        comments={commentsPage.items}
        initialCursor={commentsPage.nextCursor}
        loadMore={loadMoreComments.bind(null, id)}
        postId={id}
        currentUser={currentUser}
        canModerate={canModerate}
      />
    </div>
  );
}
