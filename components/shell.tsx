import type { ReactNode } from "react";
import { AppShell } from "./app-shell";
import { NotificationPopups } from "./notification-popups";
import { LiveRefresh } from "./live-refresh";
import { requireProfile } from "@/lib/auth";
import { getMyGroups, getUnreadCount } from "@/lib/data/queries";

/**
 * Server wrapper that loads the shell's own data (profile, group list, unread
 * badge) so each page only supplies its content.
 */
export async function Shell({
  children,
  rail,
  title,
  lede,
  back,
}: {
  children: ReactNode;
  rail?: ReactNode;
  title?: string;
  lede?: string;
  back?: string;
}) {
  const [profile, groups, unread] = await Promise.all([requireProfile(), getMyGroups(), getUnreadCount()]);

  return (
    <AppShell
      title={title}
      lede={lede}
      back={back}
      rail={rail}
      unread={unread}
      user={{
        displayName: profile.display_name,
        username: profile.username,
        color: groups[0]?.color ?? 3,
      }}
      groups={groups.map((g) => ({ id: g.id, name: g.name, color: g.color }))}
    >
      {children}
      {/* Mounted inside the shell so popups reach every authenticated screen. */}
      <NotificationPopups userId={profile.id} />
      <LiveRefresh />
    </AppShell>
  );
}
