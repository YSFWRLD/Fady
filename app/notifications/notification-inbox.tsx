"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/plans";
import { formatRelative, toArabicDigits } from "@/lib/domain/format";
import {
  NOTIFICATION_ICONS,
  describeNotification,
  notificationHref,
} from "@/lib/domain/notifications";

type Item = {
  id: string;
  type: string;
  groupId: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
  actorName: string | null;
  groupName: string | null;
  unread: boolean;
  createdAt: string;
};

const describe = (item: Item) => describeNotification(item.type, item.payload, item.actorName);
const hrefFor = (item: Item) => notificationHref(item);

export function NotificationInbox({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const unreadCount = items.filter((i) => i.unread).length;

  function open(item: Item) {
    startTransition(async () => {
      await markNotificationRead(item.id);
      router.push(hrefFor(item));
      router.refresh();
    });
  }

  function readAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      {unreadCount > 0 ? (
        <div style={{ display: "flex" }}>
          <Button tone="quiet" size="sm" loading={pending} onClick={readAll}>
            علّم الكل كمقروء ({toArabicDigits(unreadCount)})
          </Button>
        </div>
      ) : null}

      {items.map((item) => {
        const p = NOTIFICATION_ICONS[item.type] ?? { icon: "ph-bell", tone: "var(--text-muted)" };
        return (
          <Card key={item.id} variant={item.unread ? "flat" : "bare"} tone={item.unread ? "surface" : "quiet"} onClick={() => open(item)}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  flex: "0 0 auto",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-quiet)",
                  color: p.tone,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 20,
                }}
              >
                <i className={`ph-bold ${p.icon}`} aria-hidden="true" />
              </span>
              <div style={{ display: "grid", gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ font: "var(--body-md)", fontWeight: item.unread ? 700 : 400, color: "var(--text-strong)" }}>
                  {describe(item)}
                </span>
                <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
                  {[item.groupName, formatRelative(new Date(item.createdAt))].filter(Boolean).join(" · ")}
                </span>
              </div>
              {item.unread ? (
                <span
                  aria-label="غير مقروء"
                  style={{ width: 10, height: 10, borderRadius: 999, background: "var(--accent)", flex: "0 0 auto" }}
                />
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
