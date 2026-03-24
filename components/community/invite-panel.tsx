"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  inviteByUsername,
  generateInviteLink,
} from "@/lib/actions/community";

interface InvitePanelProps {
  communityId: string;
}

export function InvitePanel({ communityId }: InvitePanelProps) {
  const [username, setUsername] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleInviteByUsername() {
    if (!username.trim()) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    const result = await inviteByUsername(communityId, username.trim());
    if (result?.error) setError(result.error);
    else {
      setMessage(`Invite sent to ${username}`);
      setUsername("");
    }
    setLoading(false);
  }

  async function handleGenerateLink() {
    setLoading(true);
    setError(null);
    setMessage(null);
    const result = await generateInviteLink(communityId);
    if (result?.error) setError(result.error);
    else if (result?.url) {
      setInviteUrl(result.url);
      setMessage("Invite link generated");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold">Invite members</h3>

      <div className="flex gap-2">
        <Input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="flex-1"
        />
        <Button size="sm" onClick={handleInviteByUsername} loading={loading}>
          Invite
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateLink}
          loading={loading}
        >
          Generate invite link
        </Button>
        {inviteUrl && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(inviteUrl);
              setMessage("Link copied!");
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Copy link
          </button>
        )}
      </div>

      {inviteUrl && (
        <p className="text-xs text-muted-foreground break-all">{inviteUrl}</p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {message && !error && (
        <p className="text-sm text-green-600">{message}</p>
      )}
    </div>
  );
}
