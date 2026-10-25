"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { NotificationItem } from "@/components/notification/notification-item";
import { MarkAllReadButton } from "@/components/notification/mark-all-read-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/nav/page-header";
import { BellIcon } from "@/components/ui/icon";

export default function NotificationsPage() {
  const notifications = useQuery(api.notifications.list);
  const hasUnread = notifications?.some((n) => !n.read) ?? false;

  return (
    <div>
      <PageHeader
        title="Notifications"
        action={hasUnread ? <MarkAllReadButton /> : undefined}
      />

      {notifications === undefined ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Spinner />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<BellIcon size={24} />}
          title="No notifications yet"
          description="Likes, comments, follows and invites will show up here."
        />
      ) : (
        <div className="divide-y divide-border">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  );
}
