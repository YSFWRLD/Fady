"use client";

import type { ReactNode } from "react";
import { toArabicDigits } from "@/lib/domain/format";
import { PLAN_CATEGORIES, type PlanCategory } from "@/lib/domain/types";

const AVATAR_SIZES = { sm: 28, md: 40, lg: 56, xl: 84 } as const;

export function memberColorVar(memberColor: number | null | undefined) {
  if (!memberColor) return "var(--plum-400)";
  return `var(--member-${String(memberColor).padStart(2, "0")})`;
}

export function Avatar({
  name,
  src,
  memberColor,
  size = "md",
  ring = true,
}: {
  name: string;
  src?: string | null;
  memberColor?: number | null;
  size?: keyof typeof AVATAR_SIZES | number;
  ring?: boolean;
}) {
  const px = typeof size === "number" ? size : AVATAR_SIZES[size];
  const initial = (name || "؟").trim().charAt(0);
  const color = memberColorVar(memberColor);
  return (
    <span
      style={{
        width: px,
        height: px,
        flex: "0 0 auto",
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        background: src ? "var(--surface-quiet)" : color,
        color: "#fff",
        fontSize: Math.round(px * 0.42),
        fontWeight: 800,
        fontFamily: "var(--font-display)",
        boxShadow: ring ? `0 0 0 3px var(--bg-page), 0 0 0 5px ${color}` : undefined,
        overflow: "hidden",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}

export type StackMember = { name: string; src?: string | null; memberColor?: number | null };

export function AvatarStack({
  members,
  max = 5,
  size = "md",
  label,
}: {
  members: StackMember[];
  max?: number;
  size?: keyof typeof AVATAR_SIZES | number;
  label?: string;
}) {
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
      <span style={{ display: "inline-flex", flexDirection: "row-reverse" }}>
        {shown.map((m, i) => (
          <span key={`${m.name}-${i}`} style={{ marginInlineStart: i === 0 ? 0 : -10 }}>
            <Avatar name={m.name} src={m.src} memberColor={m.memberColor} size={size} />
          </span>
        ))}
        {rest > 0 ? (
          <span
            style={{
              marginInlineStart: -10,
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--surface-quiet)",
              color: "var(--text-muted)",
              display: "grid",
              placeItems: "center",
              font: "var(--label-sm)",
              fontWeight: 700,
              boxShadow: "0 0 0 3px var(--bg-page)",
            }}
          >
            +{toArabicDigits(rest)}
          </span>
        ) : null}
      </span>
      {label ? <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>{label}</span> : null}
    </span>
  );
}

/** OVL-008: full match reads "كلكم فاضين"; partial shows the exact count. */
export function CountMeter({
  available,
  total,
  size = "md",
  label,
}: {
  available: number;
  total: number;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const full = available >= total && total > 0;
  const big = size === "lg" ? 44 : size === "sm" ? 24 : 34;
  return (
    <span style={{ display: "inline-grid", gap: 2, justifyItems: "start" }}>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: big,
          lineHeight: 1,
          color: full ? "var(--accent-2)" : "var(--text-strong)",
        }}
      >
        {toArabicDigits(available)}
        <span style={{ fontSize: big * 0.45, fontWeight: 700, color: "var(--text-muted)" }}>
          {" "}
          من {toArabicDigits(total)}
        </span>
      </span>
      <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
        {label || (full ? "كلكم فاضين" : "فاضين")}
      </span>
    </span>
  );
}

export function CategoryIcon({
  category = "other",
  size = 48,
  tone = "quiet",
  withLabel = false,
}: {
  category?: PlanCategory;
  size?: number;
  tone?: "quiet" | "accent" | "plum";
  withLabel?: boolean;
}) {
  const c = PLAN_CATEGORIES[category] ?? PLAN_CATEGORIES.other;
  const tones = {
    quiet: { background: "var(--surface-quiet)", color: "var(--text-strong)" },
    accent: { background: "var(--accent)", color: "var(--text-on-accent)" },
    plum: { background: "var(--accent-2)", color: "var(--text-on-band)" },
  } as const;
  const box = (
    <span
      title={c.ar}
      style={{
        width: size,
        height: size,
        flex: "0 0 auto",
        borderRadius: size <= 48 ? "var(--radius-sm)" : "var(--radius-md)",
        display: "grid",
        placeItems: "center",
        fontSize: Math.round(size * 0.5),
        ...tones[tone],
      }}
    >
      <i className={`ph-bold ${c.icon}`} aria-hidden="true" />
    </span>
  );
  if (!withLabel) return box;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-3)" }}>
      {box}
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--text-strong)" }}>
        {c.ar}
      </span>
    </span>
  );
}

/**
 * AVL-009: name + initial + count accompany the colour, so availability is
 * never communicated by colour alone.
 */
export function MemberAvailabilityRow({
  name,
  memberColor,
  src,
  blocks,
  count,
  isYou = false,
  dayLabels,
}: {
  name: string;
  memberColor: number;
  src?: string | null;
  blocks: boolean[];
  count: number;
  isYou?: boolean;
  dayLabels?: string[];
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minHeight: "var(--tap-min)" }}>
      <Avatar name={name} src={src} memberColor={memberColor} size="sm" ring={false} />
      <span style={{ font: "var(--label-md)", color: "var(--text-strong)", minWidth: 68, fontWeight: 700 }}>
        {name}
        {isYou ? <span style={{ color: "var(--text-faint)", fontWeight: 400 }}> (أنت)</span> : null}
      </span>
      <span style={{ display: "flex", gap: 3, flex: 1 }}>
        {blocks.map((on, i) => (
          <span
            key={i}
            title={dayLabels?.[i]}
            style={{
              flex: 1,
              height: 22,
              borderRadius: 7,
              background: on ? memberColorVar(memberColor) : "var(--heat-0)",
            }}
          />
        ))}
      </span>
      <span style={{ font: "var(--label-sm)", color: "var(--text-muted)", minWidth: 44, textAlign: "end" }}>
        {toArabicDigits(count)} أوقات
      </span>
    </div>
  );
}

export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: size, color: "var(--text-strong)" }}>
      فاضي<span style={{ color: "var(--accent)" }}>؟</span>
    </span>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span style={{ display: "grid", gap: 2 }}>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--text-strong)" }}>
        {value}
      </span>
      <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>{label}</span>
    </span>
  );
}
