"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/plans";
import { formatRelative, formatRange, toArabicDigits } from "@/lib/domain/format";

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

/** §7.4 — Arabic copy and icon per notification type. */
const PRESENTATION: Record<string, { icon: string; tone: string }> = {
  friend_request: { icon: "ph-user-plus", tone: "var(--text-muted)" },
  full_overlap: { icon: "ph-confetti", tone: "var(--celebrate-fg)" },
  near_overlap: { icon: "ph-eyes", tone: "var(--accent-hover)" },
  suggestion_created: { icon: "ph-lightbulb", tone: "var(--accent-hover)" },
  vote_activity: { icon: "ph-check-square-offset", tone: "var(--accent-hover)" },
  plan_confirmed: { icon: "ph-confetti", tone: "var(--celebrate-fg)" },
  rsvp_required: { icon: "ph-hand-waving", tone: "var(--accent-2)" },
  plan_cancelled: { icon: "ph-x-circle", tone: "var(--danger)" },
  plan_reminder_24h: { icon: "ph-alarm", tone: "var(--text-muted)" },
};

function describe(item: Item): string {
  const actor = item.actorName ?? "أحدهم";
  const start = item.payload.start_at ? new Date(String(item.payload.start_at)) : null;
  const end = item.payload.end_at ? new Date(String(item.payload.end_at)) : null;
  const available = Number(item.payload.available ?? 0);
  const total = Number(item.payload.total ?? 0);

  switch (item.type) {
    case "friend_request":
      return "جاك طلب صداقة جديد";
    case "full_overlap":
      return start && end ? `🎉 كلكم فاضين ${formatRange(start, end)}` : "🎉 كلكم فاضين";
    case "near_overlap":
      return start && end
        ? `👀 ${toArabicDigits(available)} من ${toArabicDigits(total)} فاضين ${formatRange(start, end)}`
        : "👀 أغلبكم فاضين";
    case "suggestion_created":
      return `${actor} اقترح خطة`;
    case "vote_activity":
      return "فيه تصويت جديد على الخطة";
    case "plan_confirmed":
      return "🎉 الخطة ثبتت";
    case "rsvp_required":
      return "بتجي؟ أكّد حضورك";
    case "plan_cancelled":
      return "الخطة انلغت";
    case "plan_reminder_24h":
      return "خطتكم بكرة";
    default:
      return "تحديث جديد";
  }
}

/** Notifications always link to an authorized internal route (§7.4). */
function hrefFor(item: Item): string {
  if (item.type === "friend_request") return "/friends";
  if (!item.groupId) return "/home";
  if (item.type === "suggestion_created" || item.type === "vote_activity") {
    return item.entityId ? `/groups/${item.groupId}/plans/${item.entityId}` : `/groups/${item.groupId}`;
  }
  if (item.type === "plan_confirmed" || item.type === "rsvp_required" || item.type === "plan_cancelled" || item.type === "plan_reminder_24h") {
    return item.entityId ? `/groups/${item.groupId}/events/${item.entityId}` : `/groups/${item.groupId}`;
  }
  return `/groups/${item.groupId}`;
}

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
        const p = PRESENTATION[item.type] ?? { icon: "ph-bell", tone: "var(--text-muted)" };
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
