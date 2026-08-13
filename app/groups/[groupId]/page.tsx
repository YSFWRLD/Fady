import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { Section } from "@/components/app-shell";
import { GroupCalendarGrid } from "@/components/group-calendar-grid";
import { InviteLinkCard } from "@/components/invite-link-card";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Avatar, AvatarStack, CategoryIcon, CountMeter } from "@/components/ui/identity";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getGroupCalendar, getOpenRounds, getUpcomingPlans } from "@/lib/data/queries";
import { formatDayShort, formatRange, formatTime, toArabicDigits } from "@/lib/domain/format";
import type { OverlapSlot } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

/** §5.5 — a vertical mobile feed, not a dense month grid. */
export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const profile = await requireProfile(`/groups/${groupId}`);
  const supabase = await createClient();

  const { data: group } = await supabase.from("groups").select("id, name, image_path").eq("id", groupId).maybeSingle();
  // §5.3: unknown ids, deleted groups, and non-membership all look the same.
  if (!group) notFound();

  const [{ members, slots, overlaps }, rounds, plans, { data: invite }] = await Promise.all([
    getGroupCalendar(groupId),
    getOpenRounds(),
    getUpcomingPlans(20),
    supabase.from("group_invites").select("id").eq("group_id", groupId).is("revoked_at", null).maybeSingle(),
  ]);

  const groupRounds = rounds.filter((r) => r.groupId === groupId);
  const groupPlans = plans.filter((p) => p.groupId === groupId);
  const me = members.find((m) => m.userId === profile.id);
  const best = overlaps[0];
  const iHaveAvailability = slots.some((s) => s.userId === profile.id);

  return (
    <Shell back="/groups" rail={<GroupRail overlaps={overlaps} groupId={groupId} isAdmin={me?.role !== "member"} />}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <Avatar name={group.name} memberColor={me?.color ?? 3} size="xl" />
        <div style={{ display: "grid", gap: 4, flex: 1, minWidth: 200 }}>
          <h1
            dir="auto"
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(28px, 6vw, 42px)",
              color: "var(--text-strong)",
            }}
          >
            {group.name}
          </h1>
          <AvatarStack
            members={members.map((m) => ({ name: m.displayName, memberColor: m.color }))}
            max={6}
            size="sm"
            label={`${toArabicDigits(members.length)} أعضاء`}
          />
        </div>
      </div>

      <InviteLinkCard
        groupId={groupId}
        groupName={group.name}
        canManage={me?.role === "owner" || me?.role === "admin"}
        hasActiveInvite={Boolean(invite)}
      />

      {best ? (
        <Card variant="sticker" tilt="a" tone="celebrate">
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <Badge tone="solid">أفضل وقت</Badge>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, lineHeight: 1.05, color: "var(--text-strong)" }}>
              {best.isFullMatch ? "🎉 كلكم فاضين" : `${toArabicDigits(best.availableCount)} من ${toArabicDigits(best.totalActiveMembers)} فاضين`}
              <br />
              {formatRange(best.startAt, best.endAt)}
            </span>
            <CountMeter available={best.availableCount} total={best.totalActiveMembers} />
            <LinkButton
              href={`/groups/${groupId}/plans/new?start=${encodeURIComponent(best.startAt.toISOString())}&end=${encodeURIComponent(best.endAt.toISOString())}`}
              block
            >
              وش الخطة؟
            </LinkButton>
          </div>
        </Card>
      ) : null}

      <Section
        title="مين فاضي"
        action={
          <LinkButton href={`/groups/${groupId}/availability`} size="sm">
            حط وقتك
          </LinkButton>
        }
      >
        {slots.length === 0 ? (
          <EmptyState
            icon={<i className="ph-bold ph-calendar-plus" aria-hidden="true" />}
            title={iHaveAvailability ? "ننتظر الباقين يحطون وقتهم" : "لسه ما أحد حط وقته"}
            body="حط وقتك أول، وبعدين شارك القروب مع الباقين."
            action={<LinkButton href={`/groups/${groupId}/availability`}>حط وقتك</LinkButton>}
          />
        ) : (
          <Card variant="flat" tone="quiet">
            <GroupCalendarGrid
              currentUserId={profile.id}
              members={members.map((m) => ({ userId: m.userId, displayName: m.displayName, color: m.color }))}
              slots={slots.map((s) => ({
                userId: s.userId,
                startAt: s.startAt.toISOString(),
                endAt: s.endAt.toISOString(),
              }))}
            />
          </Card>
        )}
      </Section>

      {groupRounds.length > 0 ? (
        <Section title="تصويت مفتوح">
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {groupRounds.map((r) => (
              <Card key={r.id} variant="flat" href={`/groups/${groupId}/plans/${r.id}`}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <span style={{ font: "var(--title-md)", color: "var(--text-strong)", flex: 1 }}>
                    خطة {formatDayShort(r.windowStartAt)} {formatTime(r.windowStartAt)}
                  </span>
                  <Badge tone="accent">{toArabicDigits(r.suggestionCount)} خطط</Badge>
                  {!r.iVoted ? <Badge tone="plum">صوّت</Badge> : null}
                </div>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      {groupPlans.length > 0 ? (
        <Section title="خطط جاية">
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {groupPlans.map((p) => (
              <Card key={p.id} variant="flat" href={`/groups/${groupId}/events/${p.id}`}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                  <CategoryIcon category={p.category} size={48} />
                  <div style={{ display: "grid", gap: 2, flex: 1, minWidth: 0 }}>
                    <span dir="auto" style={{ font: "var(--title-md)", color: "var(--text-strong)" }}>
                      {p.title}
                    </span>
                    <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
                      {formatDayShort(p.startAt)} · {formatTime(p.startAt)}
                    </span>
                  </div>
                  <Badge tone="celebrate">الخطة ثبتت</Badge>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        title="الأعضاء"
        action={
          <LinkButton href={`/groups/${groupId}/settings`} size="sm" tone="quiet">
            إعدادات القروب
          </LinkButton>
        }
      >
        <Card variant="flat">
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {members.map((m) => (
              <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <Avatar name={m.displayName} memberColor={m.color} size="sm" ring={false} />
                <span style={{ font: "var(--label-md)", color: "var(--text-strong)", flex: 1 }}>
                  {m.displayName}
                  {m.userId === profile.id ? " (أنت)" : ""}
                </span>
                {m.role === "owner" ? <Badge tone="plum">مالك</Badge> : m.role === "admin" ? <Badge>أدمن</Badge> : null}
              </div>
            ))}
          </div>
        </Card>
      </Section>
    </Shell>
  );
}

function GroupRail({ overlaps, groupId, isAdmin }: { overlaps: OverlapSlot[]; groupId: string; isAdmin: boolean }) {
  const others = overlaps.slice(1);
  return (
    <>
      {others.length > 0 ? (
        <Card variant="flat">
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <span style={{ font: "var(--title-sm)", color: "var(--text-strong)" }}>أوقات ثانية</span>
            {others.map((o) => (
              <div key={o.startAt.toISOString()} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span style={{ font: "var(--body-md)", color: "var(--text-body)", flex: 1 }}>
                  {formatRange(o.startAt, o.endAt)}
                </span>
                <Badge tone={o.isFullMatch ? "celebrate" : "neutral"}>
                  {toArabicDigits(o.availableCount)} من {toArabicDigits(o.totalActiveMembers)}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card variant="flat" tone="quiet">
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
            كل الأوقات بتوقيت السعودية.
          </span>
          <LinkButton href={`/groups/${groupId}/plans/new`} tone="quiet" size="sm" block>
            ابدأ تصويت على وقت ثاني
          </LinkButton>
          {isAdmin ? (
            <LinkButton href={`/groups/${groupId}/settings`} tone="outline" size="sm" block>
              إعدادات القروب
            </LinkButton>
          ) : null}
        </div>
      </Card>
    </>
  );
}
