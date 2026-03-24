"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { NotificationWithActor } from "@/lib/types/database";
import { markNotificationRead } from "@/lib/actions/notification";
import { acceptInvite, declineInvite } from "@/lib/actions/community";
import { formatRelative } from "@/lib/utils/date";
import { useState } from "react";

interface NotificationItemProps {
  notification: NotificationWithActor;
}

function buildMessage(n: NotificationWithActor): string {
  const actor = n.actor?.username ?? "Someone";
  switch (n.type) {
    case "like":
      return `${actor} liked your post`;
    case "comment":
      return `${actor} commented on your post`;
    case "follow":
      return `${actor} started following you`;
    case "community_invite":
      return `${actor} invited you to ${n.community?.name ?? "a community"}`;
    default:
      return "New notification";
  }
}

export function NotificationItem({ notification: n }: NotificationItemProps) {
  const [handled, setHandled] = useState(false);

  async function handleRead() {
    if (!n.read) await markNotificationRead(n.id);
  }

  async function handleAccept() {
    if (!n.community_id) return;
    const { data } = await getInviteForNotification(n);
    if (data) {
      await acceptInvite(data.id);
      setHandled(true);
    }
  }

  async function handleDecline() {
    if (!n.community_id) return;
    const { data } = await getInviteForNotification(n);
    if (data) {
      await declineInvite(data.id);
      setHandled(true);
    }
  }

  const href =
    n.type === "follow" && n.actor
      ? `/profile/${n.actor.username}`
      : n.type === "community_invite" && n.community
        ? `/communities/${n.community.slug}`
        : n.post_id
          ? `/post/${n.post_id}`
          : n.actor
            ? `/profile/${n.actor.username}`
            : "/home";

  return (
    <div
      className={`flex items-start gap-3 rounded-md p-3 transition-colors ${
        n.read ? "opacity-60" : "bg-muted/30"
      }`}
    >
      {n.actor && (
        <Link href={`/profile/${n.actor.username}`}>
          <Avatar
            src={n.actor.avatar_url}
            alt={n.actor.username}
            size="sm"
          />
        </Link>
      )}
      <div className="flex-1 min-w-0">
        <Link href={href} onClick={handleRead} className="block">
          <p className="text-sm">{buildMessage(n)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatRelative(n.created_at)}
          </p>
        </Link>
        {n.type === "community_invite" && !handled && (
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={handleAccept}>
              Accept
            </Button>
            <Button variant="outline" size="sm" onClick={handleDecline}>
              Decline
            </Button>
          </div>
        )}
        {handled && (
          <p className="text-xs text-muted-foreground mt-1">Handled</p>
        )}
      </div>
    </div>
  );
}

async function getInviteForNotification(n: NotificationWithActor) {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data } = await supabase
    .from("community_invites")
    .select("id")
    .eq("community_id", n.community_id!)
    .eq("invitee_id", n.user_id)
    .eq("status", "pending")
    .single();
  return { data };
}
