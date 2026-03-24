"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  const [member, setMember] = useState(isMember);
  const [loading, setLoading] = useState(false);

  if (isCreator) return null;

  async function handleClick() {
    setLoading(true);
    if (member) {
      await leaveCommunity(communityId);
      setMember(false);
    } else {
      await joinCommunity(communityId);
      setMember(true);
    }
    setLoading(false);
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
      loading={loading}
    >
      {member ? "Leave" : "Join"}
    </Button>
  );
}
