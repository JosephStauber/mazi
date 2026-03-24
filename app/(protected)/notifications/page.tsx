import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/queries/profiles";
import { getNotifications } from "@/lib/queries/notifications";
import { NotificationItem } from "@/components/notification/notification-item";
import { MarkAllReadButton } from "@/components/notification/mark-all-read-button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const notifications = await getNotifications(user.id);
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Notifications</h1>
        {hasUnread && <MarkAllReadButton />}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="You're all caught up."
        />
      ) : (
        <div className="space-y-1">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  );
}
