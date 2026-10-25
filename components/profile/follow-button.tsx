"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import { errorMessage } from "@/lib/utils/errors";

interface FollowButtonProps {
  targetUserId: string;
  isFollowing: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function FollowButton({
  targetUserId,
  isFollowing,
  size = "sm",
  className,
}: FollowButtonProps) {
  const { toast } = useToast();
  const toggle = useMutation(api.follows.toggle);
  // Optimistic value while the mutation is in flight; the live query takes
  // over once it lands (Convex updates subscriptions before resolving).
  const [pending, setPending] = useState<boolean | null>(null);
  const [hovered, setHovered] = useState(false);
  const following = pending ?? isFollowing;

  async function handleClick() {
    setPending(!following);
    try {
      await toggle({ targetUserId: targetUserId as Id<"profiles"> });
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setPending(null);
    }
  }

  return (
    <Button
      variant={following ? "outline" : "default"}
      size={size}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      loading={pending !== null}
      className={cn(following && "min-w-[6rem]", className)}
    >
      {following ? (hovered ? "Unfollow" : "Following") : "Follow"}
    </Button>
  );
}
