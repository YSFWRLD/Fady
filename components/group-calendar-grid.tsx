"use client";

import { useMemo, useState } from "react";
import { SegmentedTabs } from "@/components/ui/form";
import { Avatar } from "@/components/ui/identity";
import {
  addDays,
  isWeekend,
  riyadhStartOfDay,
  toArabicDigits,
  weekdayName,
  riyadhParts,
} from "@/lib/domain/format";

type Member = { userId: string; displayName: string; color: number };
type Slot = { userId: string; startAt: string; endAt: string };

/**
 * AVL-010 — seven days at a time across the 28-day horizon.
 * AVL-009/GRP-010 — each row carries the member's avatar, name, and count, so
 * the colour is an accent rather than the only cue.
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

  // A member counts as free on a day when any interval overlaps that Riyadh day.
  const isFree = (userId: string, day: Date) => {
    const dayEnd = addDays(day, 1);
    return parsed.some((s) => s.userId === userId && s.start < dayEnd && s.end > day);
  };

  const perDayCounts = days.map((day) => members.filter((m) => isFree(m.userId, day)).length);
  const total = members.length;

  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
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
        <div style={{ display: "grid", gap: "var(--space-3)", minWidth: 460 }}>
          <div style={{ display: "grid", gridTemplateColumns: "110px repeat(7, 1fr)", gap: 6 }}>
            <span />
            {days.map((d) => (
              <span key={d.toISOString()} style={{ display: "grid", gap: 2, justifyItems: "center" }}>
                <span style={{ font: "var(--label-sm)", color: isWeekend(d) ? "var(--accent-2)" : "var(--text-muted)" }}>
                  {weekdayName(d).replace("ال", "")}
                </span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "var(--text-strong)" }}>
                  {toArabicDigits(riyadhParts(d).day)}
                </span>
              </span>
            ))}
          </div>

          {members.map((m) => {
            const count = days.filter((d) => isFree(m.userId, d)).length;
            return (
              <div
                key={m.userId}
                style={{ display: "grid", gridTemplateColumns: "110px repeat(7, 1fr)", gap: 6, alignItems: "center" }}
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
                {days.map((d) => {
                  const on = isFree(m.userId, d);
                  return (
                    <span
                      key={d.toISOString()}
                      title={`${m.displayName} — ${weekdayName(d)} ${toArabicDigits(riyadhParts(d).day)}: ${on ? "فاضي" : "مو فاضي"}`}
                      style={{
                        height: 30,
                        borderRadius: 9,
                        background: on ? `var(--member-${String(m.color).padStart(2, "0")})` : "var(--heat-0)",
                      }}
                    />
                  );
                })}
                <span className="sr-only">{`${m.displayName}: ${count} أيام`}</span>
              </div>
            );
          })}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "110px repeat(7, 1fr)",
              gap: 6,
              alignItems: "center",
              paddingTop: "var(--space-2)",
              borderTop: "2px solid var(--border-hairline)",
            }}
          >
            <span style={{ font: "var(--label-sm)", fontWeight: 700, color: "var(--text-muted)" }}>كم واحد فاضي</span>
            {perDayCounts.map((n, i) => (
              <span
                key={i}
                style={{
                  display: "grid",
                  placeItems: "center",
                  height: 30,
                  borderRadius: 9,
                  background:
                    n === total && total > 0
                      ? "var(--heat-full)"
                      : n >= Math.ceil(total * 0.75)
                        ? "var(--heat-3)"
                        : n >= Math.ceil(total * 0.4)
                          ? "var(--heat-2)"
                          : n >= 1
                            ? "var(--heat-1)"
                            : "var(--heat-0)",
                  color: n >= Math.ceil(total * 0.75) && n > 0 ? "#fff" : "var(--text-body)",
                  font: "var(--label-sm)",
                  fontWeight: 700,
                }}
              >
                {toArabicDigits(n)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
