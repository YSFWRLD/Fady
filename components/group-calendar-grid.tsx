"use client";

import { useMemo, useState } from "react";
import { SegmentedTabs } from "@/components/ui/form";
import { Avatar } from "@/components/ui/identity";
import {
  addDays,
  isWeekend,
  riyadhDateTime,
  riyadhParts,
  riyadhStartOfDay,
  toArabicDigits,
  weekdayName,
} from "@/lib/domain/format";

type Member = { userId: string; displayName: string; color: number };
type Slot = { userId: string; startAt: string; endAt: string };

/**
 * The five AVL-003 quick blocks, mirrored from the availability editor so the
 * calendar reads back in the same units people entered. 12–2 ص is the two hours
 * after that evening, so it lands on the next calendar date.
 */
const BLOCKS = [
  { id: "b1", short: "٤", label: "٤ - ٦ م", startHour: 16, endHour: 18 },
  { id: "b2", short: "٦", label: "٦ - ٨ م", startHour: 18, endHour: 20 },
  { id: "b3", short: "٨", label: "٨ - ١٠ م", startHour: 20, endHour: 22 },
  { id: "b4", short: "١٠", label: "١٠ م - ١٢ ص", startHour: 22, endHour: 24 },
  { id: "b5", short: "١٢", label: "١٢ - ٢ ص", startHour: 24, endHour: 26 },
] as const;

/**
 * AVL-010 — seven days at a time across the 28-day horizon.
 * AVL-009/GRP-010 — each row carries the member's avatar, name, and count, so
 * colour is an accent rather than the only cue.
 *
 * Each day is split into the five time blocks rather than being a single
 * free/busy square: seeing *which hours* overlap is the whole point of the
 * screen, and a day-level cell can't answer "when".
 */
export function GroupCalendarGrid({
  members,
  slots,
  currentUserId,
}: {
  members: Member[];
  slots: Slot[];
  currentUserId: string;
}) {
  const [week, setWeek] = useState<"w1" | "w2" | "w3" | "w4">("w1");
  const weekIndex = Number(week.slice(1)) - 1;

  const days = useMemo(() => {
    const first = riyadhStartOfDay(new Date());
    return Array.from({ length: 7 }, (_, i) => addDays(first, weekIndex * 7 + i));
  }, [weekIndex]);

  const parsed = useMemo(
    () => slots.map((s) => ({ userId: s.userId, start: new Date(s.startAt), end: new Date(s.endAt) })),
    [slots],
  );

  /** A member covers a block when an interval spans the whole block. */
  const coversBlock = (userId: string, day: Date, block: (typeof BLOCKS)[number]) => {
    const start = riyadhDateTime(day, block.startHour);
    const end = riyadhDateTime(day, block.endHour);
    return parsed.some((s) => s.userId === userId && s.start <= start && s.end >= end);
  };

  const total = members.length;

  /** How many members are free in each block of a day. */
  const blockCounts = (day: Date) =>
    BLOCKS.map((b) => members.filter((m) => coversBlock(m.userId, day, b)).length);

  /** The block with the most people free that day — the "when" headline. */
  const bestBlock = (day: Date) => {
    const counts = blockCounts(day);
    const max = Math.max(...counts);
    if (max === 0) return null;
    const idx = counts.indexOf(max);
    return { block: BLOCKS[idx], count: max };
  };

  const heat = (n: number) =>
    n === 0
      ? "var(--heat-0)"
      : n === total && total > 0
        ? "var(--heat-full)"
        : n >= Math.ceil(total * 0.75)
          ? "var(--heat-3)"
          : n >= Math.ceil(total * 0.4)
            ? "var(--heat-2)"
            : "var(--heat-1)";

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
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

      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gap: "var(--space-3)", minWidth: 620 }}>
          {/* Day header with the best time of that day underneath. */}
          <div style={{ display: "grid", gridTemplateColumns: "120px repeat(7, 1fr)", gap: 6 }}>
            <span />
            {days.map((d) => {
              const best = bestBlock(d);
              return (
                <span key={d.toISOString()} style={{ display: "grid", gap: 2, justifyItems: "center" }}>
                  <span style={{ font: "var(--label-sm)", color: isWeekend(d) ? "var(--accent-2)" : "var(--text-muted)" }}>
                    {weekdayName(d).replace("ال", "")}
                  </span>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "var(--text-strong)" }}>
                    {toArabicDigits(riyadhParts(d).day)}
                  </span>
                  <span
                    style={{
                      font: "var(--label-sm)",
                      fontSize: 11,
                      color: best ? "var(--accent-2)" : "var(--text-faint)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {best ? `${best.block.label} · ${toArabicDigits(best.count)}` : "—"}
                  </span>
                </span>
              );
            })}
          </div>

          {/* Block legend, so the five sub-bars in each cell are readable. */}
          <div style={{ display: "grid", gridTemplateColumns: "120px repeat(7, 1fr)", gap: 6 }}>
            <span style={{ font: "var(--label-sm)", color: "var(--text-faint)" }}>الفترات</span>
            {days.map((d) => (
              <span key={d.toISOString()} style={{ display: "flex", gap: 2 }}>
                {BLOCKS.map((b) => (
                  <span
                    key={b.id}
                    title={b.label}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      font: "var(--label-sm)",
                      fontSize: 9,
                      color: "var(--text-faint)",
                    }}
                  >
                    {b.short}
                  </span>
                ))}
              </span>
            ))}
          </div>

          {members.map((m) => {
            const freeBlocks = days.reduce(
              (sum, d) => sum + BLOCKS.filter((b) => coversBlock(m.userId, d, b)).length,
              0,
            );
            return (
              <div
                key={m.userId}
                style={{ display: "grid", gridTemplateColumns: "120px repeat(7, 1fr)", gap: 6, alignItems: "center" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <Avatar name={m.displayName} memberColor={m.color} size="sm" ring={false} />
                  <span
                    style={{
                      font: "var(--label-sm)",
                      fontWeight: 700,
                      color: "var(--text-strong)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.displayName}
                    {m.userId === currentUserId ? " (أنت)" : ""}
                  </span>
                </span>

                {days.map((d) => (
                  <span key={d.toISOString()} style={{ display: "flex", gap: 2 }}>
                    {BLOCKS.map((b) => {
                      const on = coversBlock(m.userId, d, b);
                      return (
                        <span
                          key={b.id}
                          title={`${m.displayName} — ${weekdayName(d)} ${toArabicDigits(riyadhParts(d).day)}، ${b.label}: ${on ? "فاضي" : "مو فاضي"}`}
                          style={{
                            flex: 1,
                            height: 26,
                            borderRadius: 5,
                            background: on ? `var(--member-${String(m.color).padStart(2, "0")})` : "var(--heat-0)",
                          }}
                        />
                      );
                    })}
                  </span>
                ))}

                <span className="sr-only">{`${m.displayName}: ${freeBlocks} فترة`}</span>
              </div>
            );
          })}

          {/* Per-block totals, so a full overlap is visible at the hour level. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px repeat(7, 1fr)",
              gap: 6,
              alignItems: "center",
              paddingTop: "var(--space-2)",
              borderTop: "2px solid var(--border-hairline)",
            }}
          >
            <span style={{ font: "var(--label-sm)", fontWeight: 700, color: "var(--text-muted)" }}>كم واحد فاضي</span>
            {days.map((d) => {
              const counts = blockCounts(d);
              return (
                <span key={d.toISOString()} style={{ display: "flex", gap: 2 }}>
                  {counts.map((n, i) => (
                    <span
                      key={BLOCKS[i].id}
                      title={`${BLOCKS[i].label}: ${toArabicDigits(n)} من ${toArabicDigits(total)}`}
                      style={{
                        flex: 1,
                        display: "grid",
                        placeItems: "center",
                        height: 24,
                        borderRadius: 5,
                        background: heat(n),
                        color: n >= Math.ceil(total * 0.75) && n > 0 ? "#fff" : "var(--text-body)",
                        font: "var(--label-sm)",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {n > 0 ? toArabicDigits(n) : ""}
                    </span>
                  ))}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <span style={{ font: "var(--body-sm)", color: "var(--text-faint)" }}>
        كل عمود مقسوم على فترات: {BLOCKS.map((b) => b.label).join(" · ")} — بتوقيت السعودية.
      </span>
    </div>
  );
}
