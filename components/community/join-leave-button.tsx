"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/utils/errors";

interface JoinLeaveButtonProps {
  communityId: string;
  isMember: boolean;
  isCreator: boolean;
  privacyType: "public" | "invite_only";
}

export function JoinLeaveButton({
  communityId,
  isMember,
  isCreator,
  privacyType,
}: JoinLeaveButtonProps) {
  const { toast } = useToast();
  const join = useMutation(api.communities.join);
  const leave = useMutation(api.communities.leave);
  // Optimistic while in flight; the live community query takes over after.
  const [pending, setPending] = useState<boolean | null>(null);
  const [hovered, setHovered] = useState(false);
  const member = pending ?? isMember;

  if (isCreator) return null;

  async function handleClick() {
    const next = !member;
    const id = communityId as Id<"communities">;
    setPending(next);
    try {
      if (next) await join({ communityId: id });
      else await leave({ communityId: id });
      toast(next ? "Joined community" : "Left community", "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setPending(null);
    }
  }

  if (!member && privacyType === "invite_only") {
    return (
      <Button variant="outline" size="sm" disabled>
        Invite only
      </Button>
    );
  }

  return (
    <Button
      variant={member ? "outline" : "default"}
      size="sm"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      loading={pending !== null}
      className={member ? "min-w-[5.5rem]" : undefined}
    >
      {member ? (hovered ? "Leave" : "Joined") : "Join"}
    </Button>
  );
}
