/**
 * Notification presentation — §7.4.
 *
 * Shared by the inbox and the live popup so a notification never reads one way
 * in the tab and another way in the toast.
 */

import { formatRange, toArabicDigits } from "./format";
import type { NotificationType } from "./types";

export const NOTIFICATION_ICONS: Record<string, { icon: string; tone: string }> = {
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

export function describeNotification(
  type: NotificationType | string,
  payload: Record<string, unknown> = {},
  actorName?: string | null,
): string {
  const actor = actorName ?? "أحدهم";
  const start = payload.start_at ? new Date(String(payload.start_at)) : null;
  const end = payload.end_at ? new Date(String(payload.end_at)) : null;
  const available = Number(payload.available ?? 0);
  const total = Number(payload.total ?? 0);

  switch (type) {
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
      return "خطتكم قربت";
    default:
      return "تحديث جديد";
  }
}

/** Notifications always link to an authorized internal route (§7.4). */
export function notificationHref(item: {
  type: string;
  groupId: string | null;
  entityId: string | null;
}): string {
  if (item.type === "friend_request") return "/friends";
  if (!item.groupId) return "/home";

  if (item.type === "suggestion_created" || item.type === "vote_activity") {
    return item.entityId ? `/groups/${item.groupId}/plans/${item.entityId}` : `/groups/${item.groupId}`;
  }
  if (
    item.type === "plan_confirmed" ||
    item.type === "rsvp_required" ||
    item.type === "plan_cancelled" ||
    item.type === "plan_reminder_24h"
  ) {
    return item.entityId ? `/groups/${item.groupId}/events/${item.entityId}` : `/groups/${item.groupId}`;
  }
  return `/groups/${item.groupId}`;
}
