import { Shell } from "@/components/shell";
import { EmptyState } from "@/components/ui/card";
import { NotificationInbox } from "./notification-inbox";
import { getNotifications } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

/** NOT-001..NOT-003 — the in-app inbox. */
export default async function NotificationsPage() {
  const notifications = await getNotifications(20);

  return (
    <Shell title="الإشعارات" back="/home">
      {notifications.length === 0 ? (
        <EmptyState icon={<i className="ph-bold ph-bell-simple" aria-hidden="true" />} title="كل شيء هادي 👌" />
      ) : (
        <NotificationInbox
          items={notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))}
        />
      )}
    </Shell>
  );
}
