"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, IconButton } from "@/components/ui/button";
import { Banner, Card, Toast } from "@/components/ui/card";
import { SegmentedTabs, TimeBlockChip } from "@/components/ui/form";
import { replaceAvailability } from "@/lib/actions/availability";
import {
  addDays,
  formatRange,
  formatTime,
  isWeekend,
  riyadhDateKey,
  riyadhDateTime,
  riyadhParts,
  riyadhStartOfDay,
  toArabicDigits,
  weekdayName,
} from "@/lib/domain/format";
import { PLANNING_HORIZON_DAYS } from "@/lib/domain/types";

/**
 * AVL-003 quick blocks. The 12–2 ص block is the two hours *after* that evening,
 * so it lands on the next calendar date — hence `crossesMidnight`.
 */
const BLOCKS = [
  { id: "b1", label: "٤ - ٦ م", startHour: 16, endHour: 18, crossesMidnight: false },
  { id: "b2", label: "٦ - ٨ م", startHour: 18, endHour: 20, crossesMidnight: false },
  { id: "b3", label: "٨ - ١٠ م", startHour: 20, endHour: 22, crossesMidnight: false },
  { id: "b4", label: "١٠ م - ١٢ ص", startHour: 22, endHour: 24, crossesMidnight: false },
  { id: "b5", label: "١٢ - ٢ ص", startHour: 24, endHour: 26, crossesMidnight: true },
] as const;

type Interval = { startAt: string; endAt: string };

function blockRange(day: Date, block: (typeof BLOCKS)[number]) {
  return {
    start: riyadhDateTime(day, block.startHour),
    end: riyadhDateTime(day, block.endHour),
  };
}

const key = (day: Date, blockId: string) => `${riyadhDateKey(day)}|${blockId}`;

export function AvailabilityEditor({
  groupId,
  groupName,
  initialIntervals,
}: {
  groupId: string;
  groupName: string;
  initialIntervals: Interval[];
}) {
  const router = useRouter();
  const [week, setWeek] = useState<"w1" | "w2" | "w3" | "w4">("w1");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const today = useMemo(() => riyadhStartOfDay(new Date()), []);
  const allDays = useMemo(
    () => Array.from({ length: PLANNING_HORIZON_DAYS }, (_, i) => addDays(today, i)),
    [today],
  );

  const parsedInitial = useMemo(
    () => initialIntervals.map((i) => ({ start: new Date(i.startAt), end: new Date(i.endAt) })),
    [initialIntervals],
  );

  // A block starts selected when an existing interval fully covers it.
  const [selected, setSelected] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const day of allDays) {
      for (const block of BLOCKS) {
        const { start, end } = blockRange(day, block);
        if (parsedInitial.some((iv) => iv.start <= start && iv.end >= end)) set.add(key(day, block.id));
      }
    }
    return set;
  });

  // Anything the quick blocks cannot express is kept as an explicit custom row.
  const [customs, setCustoms] = useState<{ start: Date; end: Date }[]>(() =>
    parsedInitial.filter((iv) => {
      const durationHours = (iv.end.getTime() - iv.start.getTime()) / 3_600_000;
      const startsOnBlock = allDays.some((day) =>
        BLOCKS.some((b) => blockRange(day, b).start.getTime() === iv.start.getTime()),
      );
      return !startsOnBlock || durationHours % 2 !== 0;
    }),
  );

  const [customDay, setCustomDay] = useState<string>(riyadhDateKey(today));
  const [customStart, setCustomStart] = useState("21:00");
  const [customEnd, setCustomEnd] = useState("23:30");

  const weekIndex = Number(week.slice(1)) - 1;
  const days = allDays.slice(weekIndex * 7, weekIndex * 7 + 7);
  const now = new Date();

  function toggle(day: Date, blockId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = key(day, blockId);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function addCustom() {
    const day = allDays.find((d) => riyadhDateKey(d) === customDay) ?? today;
    const [sh, sm] = customStart.split(":").map(Number);
    const [eh, em] = customEnd.split(":").map(Number);
    const start = riyadhDateTime(day, sh, sm);
    // An end at or before the start means the user meant the following morning.
    let end = riyadhDateTime(day, eh, em);
    if (end <= start) end = riyadhDateTime(day, eh + 24, em);

    if (end <= now) {
      setError("الوقت هذا راح خلاص");
      return;
    }
    setError(null);
    setCustoms((prev) => [...prev, { start, end }]);
  }

  function collectIntervals(): Interval[] {
    const out: Interval[] = [];
    for (const day of allDays) {
      for (const block of BLOCKS) {
        if (!selected.has(key(day, block.id))) continue;
        const { start, end } = blockRange(day, block);
        // AVL-008: past blocks are read-only and never submitted.
        if (end <= now) continue;
        out.push({ startAt: start.toISOString(), endAt: end.toISOString() });
      }
    }
    for (const c of customs) {
      if (c.end <= now) continue;
      out.push({ startAt: c.start.toISOString(), endAt: c.end.toISOString() });
    }
    // The RPC merges overlapping and adjacent intervals on save (AVL-007).
    return out.sort((a, b) => a.startAt.localeCompare(b.startAt));
  }

  function save() {
    setError(null);
    const intervals = collectIntervals();
    const rangeStart = riyadhStartOfDay(new Date());
    const rangeEnd = addDays(rangeStart, PLANNING_HORIZON_DAYS);

    startTransition(async () => {
      const result = await replaceAvailability({
        groupId,
        intervals,
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
      });

      if (!result.ok) {
        // §8.4: a recoverable failure keeps the user's input and offers Retry.
        setError("ما حفظنا وقتك، جرّب مرة ثانية");
        return;
      }

      setToast("حفظنا وقتك 👌");
      router.refresh();
      setTimeout(() => setToast(null), 2500);
    });
  }

  const selectedCount = selected.size + customs.length;

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      {error ? (
        <Banner
          tone="error"
          action={
            <Button size="sm" tone="quiet" onClick={save}>
              جرّب مرة ثانية
            </Button>
          }
        >
          {error}
        </Banner>
      ) : null}

      <SegmentedTabs
        label="الأسبوع"
        active={week}
        onChange={setWeek}
        items={[
          { id: "w1", label: "هذا الأسبوع" },
          { id: "w2", label: "الجاي" },
          { id: "w3", label: "بعده" },
          { id: "w4", label: "الرابع" },
        ]}
      />

      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        {days.map((day) => (
          <Card key={day.toISOString()} variant="flat">
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: 20,
                    color: isWeekend(day) ? "var(--accent-2)" : "var(--text-strong)",
                  }}
                >
                  {weekdayName(day)}
                </span>
                <span style={{ font: "var(--label-md)", color: "var(--text-muted)" }}>
                  {toArabicDigits(riyadhParts(day).day)}
                </span>
              </div>

              <div style={{ display: "flex", gap: "var(--tap-gap)", flexWrap: "wrap" }}>
                {BLOCKS.map((block) => {
                  const { end } = blockRange(day, block);
                  const past = end <= now;
                  return (
                    <TimeBlockChip
                      key={block.id}
                      selected={selected.has(key(day, block.id))}
                      disabled={past}
                      crossesMidnight={block.crossesMidnight}
                      onClick={() => toggle(day, block.id)}
                    >
                      {block.label}
                    </TimeBlockChip>
                  );
                })}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* AVL-003: the custom-time escape hatch. */}
      <Card variant="flat" tone="quiet">
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <span style={{ font: "var(--title-sm)", color: "var(--text-strong)" }}>وقت مخصص</span>

          {customs.length > 0 ? (
            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              {customs.map((c, i) => (
                <div key={`${c.start.toISOString()}-${i}`} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{ font: "var(--body-md)", color: "var(--text-body)", flex: 1 }}>
                    {formatRange(c.start, c.end)}
                  </span>
                  <IconButton
                    tone="plain"
                    size={36}
                    label={`احذف ${formatTime(c.start)}`}
                    onClick={() => setCustoms((prev) => prev.filter((_, j) => j !== i))}
                    icon={<i className="ph-bold ph-trash" aria-hidden="true" />}
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "end" }}>
            <label style={{ display: "grid", gap: 4, flex: "1 1 140px" }}>
              <span style={{ font: "var(--label-sm)", color: "var(--text-muted)" }}>اليوم</span>
              <select
                value={customDay}
                onChange={(e) => setCustomDay(e.target.value)}
                style={{
                  minHeight: 44,
                  borderRadius: "var(--radius-md)",
                  border: "2px solid var(--border-hairline)",
                  background: "var(--surface-card)",
                  color: "var(--text-strong)",
                  font: "var(--body-md)",
                  padding: "0 12px",
                }}
              >
                {allDays.map((d) => (
                  <option key={riyadhDateKey(d)} value={riyadhDateKey(d)}>
                    {weekdayName(d)} {toArabicDigits(riyadhParts(d).day)}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ font: "var(--label-sm)", color: "var(--text-muted)" }}>من</span>
              <input
                type="time"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{
                  minHeight: 44,
                  borderRadius: "var(--radius-md)",
                  border: "2px solid var(--border-hairline)",
                  background: "var(--surface-card)",
                  color: "var(--text-strong)",
                  font: "var(--body-md)",
                  padding: "0 12px",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ font: "var(--label-sm)", color: "var(--text-muted)" }}>إلى</span>
              <input
                type="time"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{
                  minHeight: 44,
                  borderRadius: "var(--radius-md)",
                  border: "2px solid var(--border-hairline)",
                  background: "var(--surface-card)",
                  color: "var(--text-strong)",
                  font: "var(--body-md)",
                  padding: "0 12px",
                }}
              />
            </label>

            <Button tone="quiet" onClick={addCustom}>
              أضف
            </Button>
          </div>
        </div>
      </Card>

      {/* Sticky action bar. The gradient backdrop keeps the day cards from
          showing through as they scroll underneath. */}
      <div className="fady-sticky-actions">
        <Button size="lg" block loading={pending} onClick={save}>
          احفظ وقتي في {groupName} ({toArabicDigits(selectedCount)})
        </Button>
        {toast ? <Toast tone="success">{toast}</Toast> : null}
      </div>
    </div>
  );
}
