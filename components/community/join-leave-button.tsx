"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { joinCommunity, leaveCommunity } from "@/lib/actions/community";

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
  const [member, setMember] = useState(isMember);
  const [hovered, setHovered] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isCreator) return null;

  async function handleClick() {
    const next = !member;
    setMember(next);
    setLoading(true);
    const result = next
      ? await joinCommunity(communityId)
      : await leaveCommunity(communityId);
    setLoading(false);
    if (result?.error) {
      setMember(!next);
      toast(result.error, "error");
    } else {
      toast(next ? "Joined community" : "Left community", "success");
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
      loading={loading}
      className={member ? "min-w-[5.5rem]" : undefined}
    >
      {member ? (hovered ? "Leave" : "Joined") : "Join"}
    </Button>
  );
}
