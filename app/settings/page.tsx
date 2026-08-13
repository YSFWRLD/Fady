import { Shell } from "@/components/shell";
import { Section } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
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
          <SignOutButton />
        </div>
      </Section>
    </Shell>
  );
}
