"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/form";
import { CategoryIcon } from "@/components/ui/identity";
import { formatTime, riyadhParts } from "@/lib/domain/format";
import { PLAN_CATEGORIES, PLAN_CATEGORY_IDS, type PlanCategory } from "@/lib/domain/types";

export type SuggestionDraft = {
  category: PlanCategory;
  title: string;
  description: string;
  location: string;
  externalUrl: string;
  startAt: string | null;
  endAt: string | null;
};

/**
 * PLN-006/PLN-007 — category and title are required; description, location, and
 * an https link are optional. PLN-003: exact times may only be chosen inside the
 * round window, so the pickers are clamped to it.
 */
export function SuggestionFields({
  submitLabel,
  onSubmit,
  pending,
  disabled = false,
  windowStart,
  windowEnd,
}: {
  submitLabel: string;
  onSubmit: (draft: SuggestionDraft) => void;
  pending: boolean;
  disabled?: boolean;
  windowStart: string | null;
  windowEnd: string | null;
}) {
  const [category, setCategory] = useState<PlanCategory>("food");
  const [exactTime, setExactTime] = useState(false);
  const [from, setFrom] = useState(() => (windowStart ? clockValue(windowStart) : "21:00"));
  const [to, setTo] = useState(() => (windowEnd ? clockValue(windowEnd) : "23:00"));

  function handle(formData: FormData) {
    let startAt = windowStart;
    let endAt = windowEnd;

    if (exactTime && windowStart && windowEnd) {
      const base = new Date(windowStart);
      const start = withClock(base, from);
      let end = withClock(base, to);
      if (end <= start) end = new Date(end.getTime() + 24 * 3_600_000);

      // Clamp into the window rather than sending a value the server rejects.
      const lower = new Date(windowStart);
      const upper = new Date(windowEnd);
      startAt = (start < lower ? lower : start).toISOString();
      endAt = (end > upper ? upper : end).toISOString();
    }

    onSubmit({
      category,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      location: String(formData.get("location") ?? ""),
      externalUrl: String(formData.get("externalUrl") ?? ""),
      startAt,
      endAt,
    });
  }

  return (
    <form action={handle} style={{ display: "grid", gap: "var(--space-5)" }}>
      <Card variant="flat">
        <div style={{ display: "grid", gap: "var(--space-4)" }}>
          <span style={{ font: "var(--title-sm)", color: "var(--text-strong)" }}>وش نسوي؟</span>

          <div
            role="radiogroup"
            aria-label="نوع الخطة"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: "var(--space-2)" }}
          >
            {PLAN_CATEGORY_IDS.map((id) => {
              const on = id === category;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setCategory(id)}
                  style={{
                    display: "grid",
                    gap: 6,
                    justifyItems: "center",
                    padding: "12px 8px",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    background: on ? "var(--accent-quiet)" : "var(--bg-sunken)",
                    border: `2px solid ${on ? "var(--accent)" : "transparent"}`,
                  }}
                >
                  <CategoryIcon category={id} size={36} tone={on ? "accent" : "quiet"} />
                  <span style={{ font: "var(--label-sm)", fontWeight: on ? 700 : 500, color: "var(--text-strong)" }}>
                    {PLAN_CATEGORIES[id].ar}
                  </span>
                </button>
              );
            })}
          </div>

          <Input label="العنوان" name="title" placeholder="بادل في النخيل" maxLength={80} required />
          <Textarea label="تفاصيل (اختياري)" name="description" maxLength={500} rows={2} />
          <Input label="المكان (اختياري)" name="location" maxLength={120} />
          <Input
            label="رابط (اختياري)"
            name="externalUrl"
            type="url"
            dir="ltr"
            placeholder="https://"
            hint="لازم يبدأ بـ https"
          />

          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
            <input type="checkbox" checked={exactTime} onChange={(e) => setExactTime(e.target.checked)} />
            <span style={{ font: "var(--body-md)", color: "var(--text-body)" }}>حدد وقت أدق داخل الفترة</span>
          </label>

          {exactTime && windowStart && windowEnd ? (
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "end" }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ font: "var(--label-sm)", color: "var(--text-muted)" }}>من</span>
                <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} style={fieldStyle} />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ font: "var(--label-sm)", color: "var(--text-muted)" }}>إلى</span>
                <input type="time" value={to} onChange={(e) => setTo(e.target.value)} style={fieldStyle} />
              </label>
              <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
                داخل {formatTime(new Date(windowStart))} - {formatTime(new Date(windowEnd))}
              </span>
            </div>
          ) : null}
        </div>
      </Card>

      <Button type="submit" size="lg" block loading={pending} disabled={disabled}>
        {submitLabel}
      </Button>
    </form>
  );
}

function clockValue(iso: string) {
  const p = riyadhParts(new Date(iso));
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** Replaces the Riyadh wall-clock time of `base` while keeping its calendar day. */
function withClock(base: Date, clock: string) {
  const [h, m] = clock.split(":").map(Number);
  const p = riyadhParts(base);
  const dayStartUtc = Date.UTC(p.year, p.month - 1, p.day) - 3 * 3_600_000;
  return new Date(dayStartUtc + (h * 60 + m) * 60_000);
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
