import { redirect } from "next/navigation";
import { getCurrentUser, getUserCommunities } from "@/lib/queries/profiles";
import { PostComposer } from "@/components/post/post-composer";
import { PageHeader } from "@/components/nav/page-header";

export default async function ComposePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const communities = await getUserCommunities(user.id);

  return (
    <div>
      <PageHeader title="New post" back />
      <div className="pt-4">
        <PostComposer
          communities={communities}
          redirectOnSuccess="/home"
          author={{ username: user.username, avatar_url: user.avatar_url }}
          autoFocus
        />
      </div>
    </div>
  );
}
