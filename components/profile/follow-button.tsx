"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toggleFollow } from "@/lib/actions/follow";

interface FollowButtonProps {
  targetUserId: string;
  isFollowing: boolean;
}

export function FollowButton({ targetUserId, isFollowing: initial }: FollowButtonProps) {
  const [following, setFollowing] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    setFollowing(!following);
    await toggleFollow(targetUserId);
    setLoading(false);
  }

  return (
    <Button
      variant={following ? "outline" : "default"}
      size="sm"
      onClick={handleClick}
      loading={loading}
    >
      {following ? "Unfollow" : "Follow"}
    </Button>
  );
}
