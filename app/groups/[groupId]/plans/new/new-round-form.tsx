"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Banner, Card } from "@/components/ui/card";
import { SuggestionFields, type SuggestionDraft } from "@/components/suggestion-fields";
import { openPlanningRound } from "@/lib/actions/planning";
import { errorMessage } from "@/lib/domain/errors";
import { addDays, formatRange, riyadhDateTime, riyadhStartOfDay, toArabicDigits } from "@/lib/domain/format";
import { PLANNING_HORIZON_DAYS } from "@/lib/domain/types";

type OverlapOption = {
  startAt: string;
  endAt: string;
  availableCount: number;
  totalActiveMembers: number;
  isFullMatch: boolean;
};

export function NewRoundForm({
  groupId,
  totalMembers,
  presetStart,
  presetEnd,
  presetAvailable,
  overlaps,
}: {
  groupId: string;
  totalMembers: number;
  presetStart: string | null;
  presetEnd: string | null;
  presetAvailable: number | null;
  overlaps: OverlapOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [windowStart, setWindowStart] = useState<string | null>(presetStart ?? overlaps[0]?.startAt ?? null);
  const [windowEnd, setWindowEnd] = useState<string | null>(presetEnd ?? overlaps[0]?.endAt ?? null);
  const [availableCount, setAvailableCount] = useState<number | null>(
    presetAvailable ?? overlaps[0]?.availableCount ?? null,
  );
  const [manual, setManual] = useState(overlaps.length === 0 && !presetStart);
  const [confirmedEmpty, setConfirmedEmpty] = useState(false);

  const today = riyadhStartOfDay(new Date());
  const [manualDay, setManualDay] = useState(0);
  const [manualFrom, setManualFrom] = useState("21:00");
  const [manualTo, setManualTo] = useState("23:00");

  function applyManualWindow() {
    const day = addDays(today, manualDay);
    const [sh, sm] = manualFrom.split(":").map(Number);
    const [eh, em] = manualTo.split(":").map(Number);
    const start = riyadhDateTime(day, sh, sm);
    let end = riyadhDateTime(day, eh, em);
    if (end <= start) end = riyadhDateTime(day, eh + 24, em);

    setWindowStart(start.toISOString());
    setWindowEnd(end.toISOString());
    // A manual window has no precomputed count; the server still validates it.
    setAvailableCount(null);
    setConfirmedEmpty(false);
  }

  function submit(draft: SuggestionDraft) {
    if (!windowStart || !windowEnd) {
      setError("اختر الوقت أول");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await openPlanningRound({
        groupId,
        windowStartAt: windowStart,
        windowEndAt: windowEnd,
        suggestion: {
          category: draft.category,
          title: draft.title,
          description: draft.description || null,
          proposedStartAt: draft.startAt ?? windowStart,
          proposedEndAt: draft.endAt ?? windowEnd,
          location: draft.location || null,
          externalUrl: draft.externalUrl || null,
        },
      });

      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      router.push(`/groups/${groupId}/plans/${result.data.roundId}`);
      router.refresh();
    });
  }

  // PLN-002 acceptance: a window nobody is free for needs explicit confirmation.
  const needsEmptyConfirm = availableCount === 0 && !confirmedEmpty;

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      {error ? <Banner tone="error">{error}</Banner> : null}

      <Card variant="flat">
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <span style={{ font: "var(--title-sm)", color: "var(--text-strong)" }}>الوقت</span>

          {!manual ? (
            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              {overlaps.map((o) => {
                const on = o.startAt === windowStart && o.endAt === windowEnd;
                return (
                  <button
                    key={o.startAt}
                    type="button"
                    onClick={() => {
                      setWindowStart(o.startAt);
                      setWindowEnd(o.endAt);
                      setAvailableCount(o.availableCount);
                      setConfirmedEmpty(false);
                    }}
                    aria-pressed={on}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      minHeight: "var(--tap-min)",
                      padding: "10px 16px",
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer",
                      textAlign: "start",
                      background: on ? "var(--accent-quiet)" : "var(--bg-sunken)",
                      border: `2px solid ${on ? "var(--accent)" : "transparent"}`,
                      font: "var(--body-md)",
                      color: "var(--text-body)",
                    }}
                  >
                    <span style={{ flex: 1 }}>{formatRange(new Date(o.startAt), new Date(o.endAt))}</span>
                    <Badge tone={o.isFullMatch ? "celebrate" : "neutral"}>
                      {toArabicDigits(o.availableCount)} من {toArabicDigits(o.totalActiveMembers)}
                    </Badge>
                  </button>
                );
              })}
              <Button tone="quiet" size="sm" onClick={() => setManual(true)}>
                اختر وقت ثاني
              </Button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "end" }}>
                <label style={{ display: "grid", gap: 4, flex: "1 1 140px" }}>
                  <span style={{ font: "var(--label-sm)", color: "var(--text-muted)" }}>اليوم</span>
                  <select
                    value={manualDay}
                    onChange={(e) => setManualDay(Number(e.target.value))}
                    style={fieldStyle}
                  >
                    {Array.from({ length: PLANNING_HORIZON_DAYS }, (_, i) => {
                      const d = addDays(today, i);
                      return (
                        <option key={i} value={i}>
                          {formatRange(d, d).split(" - ")[0]}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ font: "var(--label-sm)", color: "var(--text-muted)" }}>من</span>
                  <input type="time" value={manualFrom} onChange={(e) => setManualFrom(e.target.value)} style={fieldStyle} />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ font: "var(--label-sm)", color: "var(--text-muted)" }}>إلى</span>
                  <input type="time" value={manualTo} onChange={(e) => setManualTo(e.target.value)} style={fieldStyle} />
                </label>
                <Button tone="quiet" onClick={applyManualWindow}>
                  اعتمد الوقت
                </Button>
              </div>
              {overlaps.length > 0 ? (
                <Button tone="quiet" size="sm" onClick={() => setManual(false)}>
                  رجوع للأوقات المقترحة
                </Button>
              ) : null}
            </div>
          )}

          {windowStart && windowEnd ? (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <span style={{ font: "var(--body-md)", fontWeight: 700, color: "var(--text-strong)" }}>
                {formatRange(new Date(windowStart), new Date(windowEnd))}
              </span>
              {availableCount !== null ? (
                <Badge tone={availableCount === totalMembers ? "celebrate" : availableCount === 0 ? "danger" : "accent"}>
                  {toArabicDigits(availableCount)} من {toArabicDigits(totalMembers)} فاضين
                </Badge>
              ) : null}
            </div>
          ) : null}

          {needsEmptyConfirm ? (
            <Banner
              tone="info"
              action={
                <Button size="sm" tone="quiet" onClick={() => setConfirmedEmpty(true)}>
                  كمّل
                </Button>
              }
            >
              ما فيه أحد فاضي في هذا الوقت. متأكد تبي تفتح تصويت عليه؟
            </Banner>
          ) : null}
        </div>
      </Card>

      <SuggestionFields
        submitLabel="افتح التصويت"
        disabled={!windowStart || needsEmptyConfirm}
        pending={pending}
        windowStart={windowStart}
        windowEnd={windowEnd}
        onSubmit={submit}
      />
    </div>
  );
}

const fieldStyle = {
  minHeight: 44,
  borderRadius: "var(--radius-md)",
  border: "2px solid var(--border-hairline)",
  background: "var(--surface-card)",
  color: "var(--text-strong)",
  font: "var(--body-md)",
  padding: "0 12px",
} as const;
