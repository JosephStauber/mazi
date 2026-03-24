import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, getUserCommunities } from "@/lib/queries/profiles";
import { PostComposer } from "@/components/post/post-composer";

export default async function ComposePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const communities = await getUserCommunities(user.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 md:hidden">
        <Link
          href="/home"
          className="text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">New post</h1>
        <span className="w-10" aria-hidden />
      </div>
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold tracking-tight">Create post</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share a photo or thought with your followers or a community.
        </p>
      </div>
      <PostComposer
        communities={communities}
        redirectOnSuccess="/home"
      />
    </div>
  );
}
