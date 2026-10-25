"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useViewer } from "@/components/providers/viewer";
import { PostComposer } from "@/components/post/post-composer";
import { PageHeader } from "@/components/nav/page-header";

export default function ComposePage() {
  const user = useViewer();
  const communities = useQuery(api.profiles.myCommunities) ?? [];

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
