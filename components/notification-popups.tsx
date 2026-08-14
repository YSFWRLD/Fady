"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  NOTIFICATION_ICONS,
  describeNotification,
  notificationHref,
} from "@/lib/domain/notifications";

type Popup = {
  id: string;
  text: string;
  icon: string;
  tone: string;
  href: string;
};

const VISIBLE_MS = 6000;

/**
 * Live notification popups.
 *
 * Notifications previously only surfaced in the inbox tab, so anything arriving
 * while you were on another screen went unnoticed until you happened to check.
 * This subscribes to your own notification rows and raises the alert wherever
 * you are in the app.
 *
 * Two layers, because they fail differently:
 *   • An in-app toast, which always works and needs no permission.
 *   • A native browser notification when you have granted permission, so it is
 *     visible even when the tab is in the background.
 *
 * Neither reaches you when the site is fully closed — that needs real Web Push
 * (a service worker plus VAPID keys and stored subscriptions), which is a
 * separate piece of infrastructure.
 */
export function NotificationPopups({ userId }: { userId: string }) {
  const router = useRouter();
  const [popups, setPopups] = useState<Popup[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const dismiss = useCallback((id: string) => {
    setPopups((prev) => prev.filter((p) => p.id !== id));
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (message) => {
          const row = message.new as {
            id: string;
            type: string;
            group_id: string | null;
            entity_id: string | null;
            payload: Record<string, unknown> | null;
          };

          const text = describeNotification(row.type, row.payload ?? {});
          const presentation = NOTIFICATION_ICONS[row.type] ?? {
            icon: "ph-bell",
            tone: "var(--text-muted)",
          };
          const href = notificationHref({
            type: row.type,
            groupId: row.group_id,
            entityId: row.entity_id,
          });

          setPopups((prev) => [...prev.slice(-2), { id: row.id, text, ...presentation, href }]);
          timers.current.push(setTimeout(() => dismiss(row.id), VISIBLE_MS));

          // Background tab: raise a real OS-level notification if allowed.
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              new Notification("فاضي؟", { body: text, tag: row.id, lang: "ar", dir: "rtl" });
            } catch {
              // Some browsers only permit this from a service worker; the
              // in-app toast still covers it.
            }
          }

          // Refresh so the header badge and any visible lists pick it up.
          router.refresh();
        },
      )
      .subscribe();

    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      void supabase.removeChannel(channel);
    };
  }, [userId, router, dismiss]);

  if (popups.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        insetInlineStart: "var(--space-4)",
        bottom: "calc(var(--bottom-nav-h) + var(--space-4))",
        zIndex: 60,
        display: "grid",
        gap: "var(--space-2)",
        maxWidth: "min(360px, calc(100vw - var(--space-8)))",
      }}
    >
      {popups.map((p) => (
        <a
          key={p.id}
          href={p.href}
          onClick={() => dismiss(p.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "12px 14px",
            borderRadius: "var(--radius-lg)",
            background: "var(--surface-card)",
            boxShadow: "var(--shadow-pop)",
            border: "2px solid var(--border-hairline)",
            textDecoration: "none",
            animation: "fady-pop-in var(--dur-pop) var(--ease-pop)",
          }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              flex: "0 0 auto",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-quiet)",
              color: p.tone,
              display: "grid",
              placeItems: "center",
              fontSize: 18,
            }}
          >
            <i className={`ph-bold ${p.icon}`} aria-hidden="true" />
          </span>
          <span style={{ font: "var(--body-md)", fontWeight: 700, color: "var(--text-strong)", flex: 1 }}>
            {p.text}
          </span>
          <button
            type="button"
            aria-label="إخفاء"
            onClick={(e) => {
              e.preventDefault();
              dismiss(p.id);
            }}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--text-faint)",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            <i className="ph-bold ph-x" aria-hidden="true" />
          </button>
        </a>
      ))}
    </div>
  );
}

// --- Browser permission, treated as the external store it actually is --------

const permissionListeners = new Set<() => void>();

function subscribeToPermission(listener: () => void) {
  permissionListeners.add(listener);
  return () => permissionListeners.delete(listener);
}

function readPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

function notifyPermissionChanged() {
  permissionListeners.forEach((l) => l());
}

/**
 * Asks for browser-notification permission. Kept as an explicit control because
 * browsers ignore (and users resent) unprompted permission requests.
 */
export function EnableBrowserNotifications() {
  // Permission is external browser state, not React state. useSyncExternalStore
  // reads it without a hydration mismatch: the server snapshot is "default" and
  // the client re-reads after hydration.
  const state = useSyncExternalStore(subscribeToPermission, readPermission, () => "default" as const);

  if (state === "unsupported") {
    return (
      <span style={{ font: "var(--body-sm)", color: "var(--text-faint)" }}>
        متصفحك ما يدعم التنبيهات.
      </span>
    );
  }

  if (state === "granted") {
    return (
      <span style={{ font: "var(--body-sm)", color: "var(--success)" }}>
        <i className="ph-bold ph-check-circle" aria-hidden="true" /> التنبيهات مفعّلة
      </span>
    );
  }

  if (state === "denied") {
    return (
      <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
        التنبيهات محظورة من إعدادات المتصفح — فعّلها من هناك.
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        await Notification.requestPermission();
        notifyPermissionChanged();
      }}
      style={{
        minHeight: 44,
        padding: "11px 22px",
        borderRadius: "var(--radius-pill)",
        border: "2px solid var(--border-strong)",
        background: "transparent",
        color: "var(--text-strong)",
        font: "var(--label-md)",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      فعّل تنبيهات المتصفح
    </button>
  );
}
