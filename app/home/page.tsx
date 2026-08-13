import { Shell, } from "@/components/shell";
import { Section } from "@/components/app-shell";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Avatar, CategoryIcon, CountMeter } from "@/components/ui/identity";
import { formatDayShort, formatRange, formatTime, toArabicDigits } from "@/lib/domain/format";
import {
  getGroupCalendar,
  getMyGroups,
  getOpenRounds,
  getUpcomingPlans,
  type GroupSummary,
} from "@/lib/data/queries";
import type { OverlapSlot } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

/**
 * §5.4 / HOM-001 — attention-first ordering:
 *   1. خطط جاية  2. يحتاج ردك  3. القروب فاضي 👀  4. قروباتي
 * HOM-001 also requires empty sections to be omitted rather than shown.
 */
export default async function HomePage() {
  const groups = await getMyGroups();

  const [plans, rounds, overlapsByGroup] = await Promise.all([
    getUpcomingPlans(5),
    getOpenRounds(),
    Promise.all(
      groups.map(async (g) => ({ group: g, overlaps: (await getGroupCalendar(g.id)).overlaps })),
    ),
  ]);

  // Most relevant unplanned overlap per group, best group first.
  const bestOverlaps = overlapsByGroup
    .filter((x) => x.overlaps.length > 0)
    .map((x) => ({ group: x.group, slot: x.overlaps[0] }))
    .sort((a, b) => Number(b.slot.isFullMatch) - Number(a.slot.isFullMatch) || b.slot.availableCount - a.slot.availableCount);

  const needsResponse = [
    ...plans.filter((p) => p.myStatus === "pending").map((p) => ({ kind: "rsvp" as const, plan: p })),
    ...rounds.filter((r) => !r.iVoted && r.suggestionCount > 0).map((r) => ({ kind: "vote" as const, round: r })),
  ];

  const groupsNeedingAvailability = groups.filter(
    (g) => !overlapsByGroup.find((o) => o.group.id === g.id)?.overlaps.length,
  );

  const isEmpty = groups.length === 0;

  return (
    <Shell
      title={plans[0] ? plans[0].title : bestOverlaps[0] ? "القروب فاضي 👀" : "فاضي؟"}
      lede={
        isEmpty
          ? "سو أول قروب وخلّ التخطيط أسهل."
          : `${toArabicDigits(groups.length)} قروبات · ${toArabicDigits(plans.length)} خطط جاية`
      }
      rail={<HomeRail best={bestOverlaps[0]} />}
    >
      {isEmpty ? (
        <EmptyState
          icon={<i className="ph-bold ph-users-three" aria-hidden="true" />}
          title="سو أول قروب وخلّ التخطيط أسهل"
          body="القروب هو المكان اللي تشوفون فيه متى كلكم فاضين."
          action={<LinkButton href="/groups/new">سو قروب</LinkButton>}
        />
      ) : null}

      {plans.length > 0 ? (
        <Section title="خطط جاية">
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {plans.map((p, i) => (
              <Card key={p.id} variant="sticker" tilt={i % 2 === 0 ? "a" : "b"} href={`/groups/${p.groupId}/events/${p.id}`}>
                <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
                  <CategoryIcon category={p.category} size={56} tone="accent" />
                  <div style={{ display: "grid", gap: 4, flex: 1, minWidth: 0 }}>
                    <span
                      dir="auto"
                      style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--text-strong)" }}
                    >
                      {p.title}
                    </span>
                    <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
                      {formatDayShort(p.startAt)} · {formatTime(p.startAt)} · {p.groupName}
                    </span>
                  </div>
                  {p.myStatus === "pending" ? (
                    <Badge tone="plum">بتجي؟</Badge>
                  ) : p.myStatus === "going" ? (
                    <Badge tone="success">جاي</Badge>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      {needsResponse.length > 0 ? (
        <Section title="يحتاج ردك">
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {needsResponse.map((item) =>
              item.kind === "rsvp" ? (
                <Card key={`rsvp-${item.plan.id}`} variant="flat" href={`/groups/${item.plan.groupId}/events/${item.plan.id}`}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "var(--radius-sm)",
                        background: "var(--accent-2-quiet)",
                        color: "var(--accent-2)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 20,
                      }}
                    >
                      <i className="ph-bold ph-hand-waving" aria-hidden="true" />
                    </span>
                    <span style={{ font: "var(--body-md)", color: "var(--text-body)", flex: 1 }}>
                      بتجي؟ أكّد حضورك — {item.plan.title}
                    </span>
                  </div>
                </Card>
              ) : (
                <Card key={`vote-${item.round.id}`} variant="flat" href={`/groups/${item.round.groupId}/plans/${item.round.id}`}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "var(--radius-sm)",
                        background: "var(--accent-quiet)",
                        color: "var(--accent-hover)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 20,
                      }}
                    >
                      <i className="ph-bold ph-check-square-offset" aria-hidden="true" />
                    </span>
                    <span style={{ font: "var(--body-md)", color: "var(--text-body)", flex: 1 }}>
                      صوّت على خطة {formatDayShort(item.round.windowStartAt)} — {item.round.groupName}
                    </span>
                    <Badge tone="accent">{toArabicDigits(item.round.suggestionCount)} خطط</Badge>
                  </div>
                </Card>
              ),
            )}
          </div>
        </Section>
      ) : null}

      {bestOverlaps.length > 0 ? (
        <Section title="القروب فاضي 👀">
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {bestOverlaps.map(({ group, slot }) => (
              <Card key={group.id} variant="flat" href={`/groups/${group.id}`}>
                <div style={{ display: "grid", gap: "var(--space-3)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <Avatar name={group.name} memberColor={group.color} size="sm" ring={false} />
                    <span style={{ font: "var(--title-sm)", color: "var(--text-strong)", flex: 1 }}>{group.name}</span>
                    {/* OVL-008 */}
                    <Badge tone={slot.isFullMatch ? "celebrate" : "accent"}>
                      {slot.isFullMatch
                        ? "🎉 كلكم فاضين"
                        : `${toArabicDigits(slot.availableCount)} من ${toArabicDigits(slot.totalActiveMembers)} فاضين`}
                    </Badge>
                  </div>
                  <span style={{ font: "var(--body-md)", color: "var(--text-body)" }}>
                    {formatRange(slot.startAt, slot.endAt)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      {groupsNeedingAvailability.length > 0 && !isEmpty ? (
        <Section title="محتاجين وقتك">
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {groupsNeedingAvailability.map((g) => (
              <Card key={g.id} variant="flat" tone="quiet" href={`/groups/${g.id}/availability`}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <Avatar name={g.name} memberColor={g.color} size="sm" ring={false} />
                  <span style={{ font: "var(--body-md)", color: "var(--text-body)", flex: 1 }}>
                    ما لقينا وقت مناسب في {g.name} للحين
                  </span>
                  <Badge tone="neutral">حط وقتك</Badge>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      {groups.length > 0 ? (
        <Section title="قروباتي" action={<LinkButton href="/groups" size="sm" tone="quiet">الكل</LinkButton>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
            {groups.map((g) => (
              <Card key={g.id} variant="flat" href={`/groups/${g.id}`}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <Avatar name={g.name} memberColor={g.color} size="lg" />
                  <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                    <span dir="auto" style={{ font: "var(--title-md)", color: "var(--text-strong)" }}>
                      {g.name}
                    </span>
                    <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
                      {toArabicDigits(g.memberCount)} أعضاء
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}
    </Shell>
  );
}

function HomeRail({ best }: { best?: { group: GroupSummary; slot: OverlapSlot } }) {
  if (!best) {
    return (
      <Card variant="flat" tone="quiet">
        <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
          كل الأوقات بتوقيت السعودية. وقتك يشوفه أعضاء القروب اللي حطيته فيه بس.
        </span>
      </Card>
    );
  }

  return (
    <>
      <Card variant="sticker" tilt="b" tone="celebrate">
        <div style={{ display: "grid", gap: "var(--space-4)" }}>
          <Badge tone="solid">القروب فاضي</Badge>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, lineHeight: 1.05, color: "var(--text-strong)" }}>
            {best.group.name}
            <br />
            {formatRange(best.slot.startAt, best.slot.endAt)}
          </span>
          <CountMeter available={best.slot.availableCount} total={best.slot.totalActiveMembers} />
          <LinkButton
            href={`/groups/${best.group.id}/plans/new?start=${encodeURIComponent(best.slot.startAt.toISOString())}&end=${encodeURIComponent(best.slot.endAt.toISOString())}`}
            block
          >
            وش الخطة؟
          </LinkButton>
        </div>
      </Card>
      <Card variant="flat" tone="quiet">
        <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
          كل الأوقات بتوقيت السعودية. وقتك يشوفه أعضاء القروب اللي حطيته فيه بس.
        </span>
      </Card>
    </>
  );
}
