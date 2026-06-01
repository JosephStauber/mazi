import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/queries/profiles";
import { getNotifications } from "@/lib/queries/notifications";
import { NotificationItem } from "@/components/notification/notification-item";
import { MarkAllReadButton } from "@/components/notification/mark-all-read-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/nav/page-header";
import { BellIcon } from "@/components/ui/icon";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const notifications = await getNotifications(user.id);
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div>
      <PageHeader
        title="Notifications"
        action={hasUnread ? <MarkAllReadButton /> : undefined}
      />

      {notifications.length === 0 ? (
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
