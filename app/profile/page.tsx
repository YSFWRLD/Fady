import { Shell } from "@/components/shell";
import { Section } from "@/components/app-shell";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/identity";
import { SignOutButton } from "@/components/sign-out-button";
import { requireProfile } from "@/lib/auth";
import { getFriends, getMyGroups } from "@/lib/data/queries";
import { toArabicDigits } from "@/lib/domain/format";

export const dynamic = "force-dynamic";

/** PRO-008 */
export default async function ProfilePage() {
  const [profile, groups, friends] = await Promise.all([requireProfile("/profile"), getMyGroups(), getFriends()]);
  const friendCount = friends.filter((f) => f.direction === "friend").length;

  return (
    <Shell title="حسابي">
      <Card variant="sticker" tilt="b">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <Avatar name={profile.display_name} memberColor={groups[0]?.color ?? 3} size="xl" />
          <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <span
              dir="auto"
              style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: "var(--text-strong)" }}
            >
              {profile.display_name}
            </span>
            <span style={{ font: "var(--body-md)", color: "var(--text-muted)", direction: "ltr" }}>
              @{profile.username}
            </span>
          </div>
        </div>
      </Card>

      <Section title="اختصارات">
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <Card variant="flat" href="/groups">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span style={{ fontSize: 22, color: "var(--accent)" }} aria-hidden="true">
                <i className="ph-bold ph-users-three" />
              </span>
              <span style={{ font: "var(--body-md)", color: "var(--text-body)", flex: 1 }}>القروبات</span>
              <Badge>{toArabicDigits(groups.length)}</Badge>
            </div>
          </Card>
          <Card variant="flat" href="/friends">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span style={{ fontSize: 22, color: "var(--accent)" }} aria-hidden="true">
                <i className="ph-bold ph-user-plus" />
              </span>
              <span style={{ font: "var(--body-md)", color: "var(--text-body)", flex: 1 }}>أصدقائي</span>
              <Badge>{toArabicDigits(friendCount)}</Badge>
            </div>
          </Card>
          <Card variant="flat" href="/calendar">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span style={{ fontSize: 22, color: "var(--accent)" }} aria-hidden="true">
                <i className="ph-bold ph-calendar-dots" />
              </span>
              <span style={{ font: "var(--body-md)", color: "var(--text-body)", flex: 1 }}>تقويمي</span>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="الإعدادات">
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <Card variant="flat" tone="quiet">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span style={{ font: "var(--body-md)", color: "var(--text-body)", flex: 1 }}>اللغة</span>
              {/* §8.6: Arabic is the only MVP language, stated rather than offered. */}
              <Badge tone="neutral">العربية</Badge>
            </div>
          </Card>
          <LinkButton href="/settings" tone="quiet" block>
            إعدادات الحساب
          </LinkButton>
          <SignOutButton />
        </div>
      </Section>
    </Shell>
  );
}
