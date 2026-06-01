"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  HeartIcon,
  CommentIcon,
  UserPlusIcon,
  CommunitiesIcon,
  AtIcon,
  BellIcon,
} from "@/components/ui/icon";
import type { NotificationWithActor, NotificationType } from "@/lib/types/database";
import { markNotificationRead } from "@/lib/actions/notification";
import { acceptInvite, declineInvite } from "@/lib/actions/community";
import { formatRelative } from "@/lib/utils/date";

interface NotificationItemProps {
  notification: NotificationWithActor;
}

function message(n: NotificationWithActor): string {
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
    case "mention":
      return n.comment_id
        ? `${actor} mentioned you in a comment`
        : `${actor} mentioned you in a post`;
    default:
      return "New notification";
  }
}

const badge: Record<
  NotificationType,
  { icon: typeof HeartIcon; className: string }
> = {
  like: { icon: HeartIcon, className: "bg-danger text-white" },
  comment: { icon: CommentIcon, className: "bg-foreground text-background" },
  follow: { icon: UserPlusIcon, className: "bg-foreground text-background" },
  community_invite: {
    icon: CommunitiesIcon,
    className: "bg-foreground text-background",
  },
  mention: { icon: AtIcon, className: "bg-foreground text-background" },
};

export function NotificationItem({ notification: n }: NotificationItemProps) {
  const { toast } = useToast();
  const [handled, setHandled] = useState<null | "accepted" | "declined">(null);
  const [busy, setBusy] = useState(false);

  function handleRead() {
    if (!n.read) markNotificationRead(n.id);
  }

  async function respond(action: "accept" | "decline") {
    if (!n.community_id) return;
    setBusy(true);
    const { data } = await getInviteForNotification(n);
    if (!data) {
      setBusy(false);
      toast("This invite is no longer available", "error");
      return;
    }
    const r =
      action === "accept" ? await acceptInvite(data.id) : await declineInvite(data.id);
    setBusy(false);
    if (r && typeof r === "object" && "error" in r && r.error) {
      toast(r.error as string, "error");
      return;
    }
    setHandled(action === "accept" ? "accepted" : "declined");
    toast(
      action === "accept"
        ? `Joined ${n.community?.name ?? "community"}`
        : "Invite declined",
      "success"
    );
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

  const Badge = badge[n.type]?.icon ?? BellIcon;
  const badgeClass = badge[n.type]?.className ?? "bg-foreground text-background";

  return (
    <div
      className={`relative flex items-start gap-3 px-1 py-3.5 transition-colors ${
        n.read ? "" : "bg-muted/30"
      }`}
    >
      {!n.read && (
        <span className="absolute right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-danger" />
      )}

      <div className="relative shrink-0">
        {n.actor ? (
          <Link href={`/profile/${n.actor.username}`}>
            <Avatar src={n.actor.avatar_url} alt={n.actor.username} size="md" />
          </Link>
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <BellIcon size={20} />
          </div>
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background ${badgeClass}`}
        >
          <Badge size={11} filled />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <Link href={href} onClick={handleRead} className="block">
          <p className="text-sm leading-snug text-foreground">{message(n)}</p>
          <p className="mt-0.5 text-xs text-subtle">
            {formatRelative(n.created_at)}
          </p>
        </Link>

        {n.type === "community_invite" && !handled && (
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" onClick={() => respond("accept")} loading={busy}>
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => respond("decline")}
              disabled={busy}
            >
              Decline
            </Button>
          </div>
        )}
        {handled && (
          <p className="mt-1.5 text-xs font-medium text-muted-foreground">
            {handled === "accepted" ? "Joined" : "Declined"}
          </p>
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
