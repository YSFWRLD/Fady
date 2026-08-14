import { Shell } from "@/components/shell";
import { Section } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
import { EnableBrowserNotifications } from "@/components/notification-popups";
import { EditProfileForm } from "./edit-profile-form";
import { requireProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** PRO-004 / PRO-008 — account, Arabic language status, and logout. */
export default async function SettingsPage() {
  const profile = await requireProfile("/settings");

  return (
    <Shell title="الإعدادات" back="/profile">
      <Section title="ملفي">
        <EditProfileForm displayName={profile.display_name} username={profile.username} />
      </Section>

      <Section title="التطبيق">
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <Card variant="flat" tone="quiet">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span style={{ font: "var(--body-md)", color: "var(--text-body)", flex: 1 }}>اللغة</span>
              <Badge tone="neutral">العربية</Badge>
            </div>
          </Card>
          <Card variant="flat" tone="quiet">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span style={{ font: "var(--body-md)", color: "var(--text-body)", flex: 1 }}>التوقيت</span>
              <Badge tone="neutral">السعودية</Badge>
            </div>
          </Card>
          <Card variant="flat" tone="quiet">
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <span style={{ font: "var(--title-sm)", color: "var(--text-strong)" }}>التنبيهات</span>
              <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
                التنبيهات تطلع لك داخل التطبيق على طول. فعّل تنبيهات المتصفح عشان توصلك حتى لو التبويب
                في الخلفية.
              </span>
              <EnableBrowserNotifications />
            </div>
          </Card>
          <SignOutButton />
        </div>
      </Section>
    </Shell>
  );
}
