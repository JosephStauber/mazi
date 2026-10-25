"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { CheckIcon } from "@/components/ui/icon";
import { errorMessage } from "@/lib/utils/errors";

interface InvitePanelProps {
  communityId: string;
}

export function InvitePanel({ communityId }: InvitePanelProps) {
  const { toast } = useToast();
  const inviteByUsername = useMutation(api.communities.inviteByUsername);
  const createInviteLink = useMutation(api.communities.createInviteLink);
  const id = communityId as Id<"communities">;
  const [username, setUsername] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function handleInviteByUsername() {
    if (!username.trim()) return;
    setInviting(true);
    try {
      await inviteByUsername({ communityId: id, username: username.trim() });
      toast(`Invite sent to ${username.trim()}`, "success");
      setUsername("");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setInviting(false);
    }
  }

  async function handleGenerateLink() {
    setGenerating(true);
    try {
      const token = await createInviteLink({ communityId: id });
      setInviteUrl(`${window.location.origin}/communities/join?token=${token}`);
      setCopied(false);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setGenerating(false);
    }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast("Link copied", "success");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground">Invite members</h3>

      <div className="mt-3 flex gap-2">
        <Input
          placeholder="Username"
          aria-label="Username to invite"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleInviteByUsername()}
          className="flex-1"
        />
        <Button size="sm" onClick={handleInviteByUsername} loading={inviting}>
          Invite
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateLink}
          loading={generating}
        >
          Generate invite link
        </Button>
        {inviteUrl && (
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? (
              <>
                <CheckIcon size={13} /> Copied
              </>
            ) : (
              "Copy link"
            )}
          </button>
        )}
      </div>

      {inviteUrl && (
        <p className="mt-2 break-all rounded-[var(--radius-md)] bg-muted px-3 py-2 text-xs text-muted-foreground">
          {inviteUrl}
        </p>
      )}
    </div>
  );
}
