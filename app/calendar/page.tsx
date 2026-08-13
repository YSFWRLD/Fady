import { Shell } from "@/components/shell";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { CategoryIcon } from "@/components/ui/identity";
import { getPersonalCalendar } from "@/lib/data/queries";
import {
  formatDayLong,
  formatRange,
  formatTime,
  riyadhDateKey,
  toArabicDigits,
} from "@/lib/domain/format";

export const dynamic = "force-dynamic";

/**
 * §5.6 / AVL-011 — only the viewer's own availability and confirmed plans.
 * CAL-001: plans use stronger cards than availability. CAL-002: entries carry
 * group identity, and confirmed-plan time conflicts are flagged but never
 * auto-resolved.
 */
export default async function CalendarPage() {
  const { slots, plans } = await getPersonalCalendar();

  type Entry =
    | { kind: "slot"; at: Date; groupName: string; startAt: Date; endAt: Date; groupId: string }
    | { kind: "plan"; at: Date; plan: (typeof plans)[number] };

  const entries: Entry[] = [
    ...slots.map((s) => ({
      kind: "slot" as const,
      at: s.startAt,
      groupName: s.groupName,
      groupId: s.groupId,
      startAt: s.startAt,
      endAt: s.endAt,
    })),
    ...plans.map((p) => ({ kind: "plan" as const, at: p.startAt, plan: p })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const byDay = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = riyadhDateKey(e.at);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }

  // CAL-002: two scheduled plans whose times overlap.
  const conflicting = new Set<string>();
  for (let i = 0; i < plans.length; i += 1) {
    for (let j = i + 1; j < plans.length; j += 1) {
      if (plans[i].startAt < plans[j].endAt && plans[j].startAt < plans[i].endAt) {
        conflicting.add(plans[i].id);
        conflicting.add(plans[j].id);
      }
    }
  }

  return (
    <Shell title="التقويم" lede="أوقاتك وخططك في كل القروبات — بتوقيت السعودية.">
      {entries.length === 0 ? (
        <EmptyState
          icon={<i className="ph-bold ph-calendar-dots" aria-hidden="true" />}
          title="لسه ما حطيت وقتك"
          body="افتح أي قروب وحط الأوقات اللي تكون فيها فاضي."
          action={<LinkButton href="/groups">القروبات</LinkButton>}
        />
      ) : null}

      {[...byDay.entries()].map(([day, dayEntries]) => (
        <section key={day} style={{ display: "grid", gap: "var(--space-3)" }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "var(--text-strong)" }}>
            {formatDayLong(dayEntries[0].at)}
          </h2>

          {/* Same-time availability across groups is summarized, not repeated. */}
          {summarizeSlots(dayEntries).map((group) => (
            <Card key={group.label} variant="bare" tone="quiet" padding="var(--space-3)">
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span style={{ width: 6, height: 28, borderRadius: 999, background: "var(--heat-2)" }} aria-hidden="true" />
                <span style={{ font: "var(--body-md)", color: "var(--text-body)", flex: 1 }}>{group.label}</span>
                <Badge tone="neutral">
                  {group.groups.length > 1
                    ? `متوفر في ${toArabicDigits(group.groups.length)} قروبات`
                    : group.groups[0]}
                </Badge>
              </div>
            </Card>
          ))}

          {dayEntries
            .filter((e): e is Extract<Entry, { kind: "plan" }> => e.kind === "plan")
            .map((e) => (
              <Card key={e.plan.id} variant="flat" href={`/groups/${e.plan.groupId}/events/${e.plan.id}`}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <CategoryIcon category={e.plan.category} size={44} tone="accent" />
                  <div style={{ display: "grid", gap: 2, flex: 1, minWidth: 0 }}>
                    <span dir="auto" style={{ font: "var(--title-sm)", color: "var(--text-strong)" }}>
                      {e.plan.title}
                    </span>
                    <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
                      {formatTime(e.plan.startAt)} · {e.plan.groupName}
                    </span>
                  </div>
                  {conflicting.has(e.plan.id) ? <Badge tone="danger">تعارض</Badge> : null}
                  {e.plan.myStatus === "going" ? <Badge tone="success">جاي</Badge> : null}
                </div>
              </Card>
            ))}
        </section>
      ))}
    </Shell>
  );
}

/** Collapses identical time ranges across groups into one row (§5.6). */
function summarizeSlots(
  entries: (
    | { kind: "slot"; at: Date; groupName: string; startAt: Date; endAt: Date; groupId: string }
    | { kind: "plan"; at: Date; plan: unknown }
  )[],
) {
  const map = new Map<string, { label: string; groups: string[] }>();
  for (const e of entries) {
    if (e.kind !== "slot") continue;
    const label = formatRange(e.startAt, e.endAt);
    const existing = map.get(label);
    if (existing) existing.groups.push(e.groupName);
    else map.set(label, { label, groups: [e.groupName] });
  }
  return [...map.values()];
}
