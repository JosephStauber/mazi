"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { toggleFollow } from "@/lib/actions/follow";
import { cn } from "@/lib/utils/cn";

interface FollowButtonProps {
  targetUserId: string;
  isFollowing: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function FollowButton({
  targetUserId,
  isFollowing: initial,
  size = "sm",
  className,
}: FollowButtonProps) {
  const { toast } = useToast();
  const [following, setFollowing] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);

  async function handleClick() {
    const next = !following;
    setFollowing(next);
    setLoading(true);
    const result = await toggleFollow(targetUserId);
    setLoading(false);
    if (result?.error) {
      setFollowing(!next);
      toast(result.error, "error");
    }
  }

  return (
    <Button
      variant={following ? "outline" : "default"}
      size={size}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      loading={loading}
      className={cn(following && "min-w-[6rem]", className)}
    >
      {following ? (hovered ? "Unfollow" : "Following") : "Follow"}
    </Button>
  );
}
