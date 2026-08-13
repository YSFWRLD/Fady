"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

const TILTS = { a: "var(--tilt-a)", b: "var(--tilt-b)", c: "var(--tilt-c)", none: "0deg" } as const;

type CardTone = "surface" | "band" | "accent" | "celebrate" | "quiet";

const CARD_TONES: Record<CardTone, CSSProperties> = {
  surface: { background: "var(--surface-card)", color: "var(--text-body)" },
  band: { background: "var(--bg-band)", color: "var(--text-on-band)" },
  accent: { background: "var(--accent)", color: "var(--text-on-accent)" },
  celebrate: {
    background: "var(--celebrate-quiet)",
    color: "var(--text-strong)",
    backgroundImage: "radial-gradient(var(--celebrate-dot) 1.5px, transparent 1.6px)",
    backgroundSize: "14px 14px",
  },
  quiet: { background: "var(--bg-sunken)", color: "var(--text-body)" },
};

export function Card({
  children,
  variant = "flat",
  tilt = "none",
  tone = "surface",
  padding,
  href,
  onClick,
}: {
  children: ReactNode;
  variant?: "flat" | "sticker" | "bare";
  tilt?: keyof typeof TILTS;
  tone?: CardTone;
  padding?: number | string;
  href?: string;
  onClick?: () => void;
}) {
  const style: CSSProperties = {
    display: "block",
    borderRadius: "var(--radius-lg)",
    padding: padding != null ? padding : "var(--card-pad)",
    boxShadow: variant === "sticker" ? "var(--shadow-sticker)" : variant === "flat" ? "var(--shadow-card)" : "none",
    transform: variant === "sticker" ? `rotate(${TILTS[tilt]})` : undefined,
    cursor: href || onClick ? "pointer" : undefined,
    textDecoration: "none",
    transition: "transform var(--dur-base) var(--ease-pop), box-shadow var(--dur-base) var(--ease-out)",
    ...CARD_TONES[tone],
  };

  if (href) {
    return (
      <Link href={href} style={style}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => e.key === "Enter" && onClick()} style={style}>
        {children}
      </div>
    );
  }
  return <div style={style}>{children}</div>;
}

type BadgeTone = "neutral" | "accent" | "plum" | "celebrate" | "success" | "danger" | "solid";

const BADGE_TONES: Record<BadgeTone, CSSProperties> = {
  neutral: { background: "var(--surface-quiet)", color: "var(--text-body)" },
  accent: { background: "var(--accent-quiet)", color: "var(--accent-hover)" },
  plum: { background: "var(--accent-2-quiet)", color: "var(--accent-2)" },
  celebrate: { background: "var(--celebrate-quiet)", color: "var(--celebrate-fg)" },
  success: { background: "var(--success-quiet)", color: "var(--success)" },
  danger: { background: "var(--danger-quiet)", color: "var(--danger)" },
  solid: { background: "var(--surface-inverse)", color: "var(--bg-page)" },
};

export function Badge({ children, tone = "neutral", icon }: { children: ReactNode; tone?: BadgeTone; icon?: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 12px",
        borderRadius: "var(--radius-pill)",
        font: "var(--label-sm)",
        fontWeight: 700,
        whiteSpace: "nowrap",
        justifySelf: "start",
        width: "fit-content",
        ...BADGE_TONES[tone],
      }}
    >
      {icon}
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  icon,
  action,
  tone = "quiet",
}: {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
  tone?: "quiet" | "bare";
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--space-4)",
        justifyItems: "center",
        textAlign: "center",
        padding: "var(--space-8) var(--space-5)",
        background: tone === "quiet" ? "var(--bg-sunken)" : "transparent",
        borderRadius: "var(--radius-xl)",
      }}
    >
      {icon ? (
        <span
          style={{
            width: 64,
            height: 64,
            borderRadius: "var(--radius-lg)",
            background: "var(--accent-quiet)",
            color: "var(--accent-hover)",
            display: "grid",
            placeItems: "center",
            fontSize: 32,
          }}
        >
          {icon}
        </span>
      ) : null}
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, lineHeight: 1.15, color: "var(--text-strong)" }}>
        {title}
      </span>
      {body ? <span style={{ font: "var(--body-md)", color: "var(--text-muted)", maxWidth: 320 }}>{body}</span> : null}
      {action}
    </div>
  );
}

export function Banner({
  children,
  tone = "error",
  action,
  onDismiss,
}: {
  children: ReactNode;
  tone?: "error" | "offline" | "info" | "success";
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  const tones = {
    error: { background: "var(--danger-quiet)", color: "var(--danger)", icon: "ph-warning-circle" },
    offline: { background: "var(--surface-quiet)", color: "var(--text-body)", icon: "ph-wifi-slash" },
    info: { background: "var(--accent-2-quiet)", color: "var(--accent-2)", icon: "ph-info" },
    success: { background: "var(--success-quiet)", color: "var(--success)", icon: "ph-check-circle" },
  } as const;
  const t = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "12px 16px",
        borderRadius: "var(--radius-md)",
        background: t.background,
        color: t.color,
        font: "var(--body-md)",
        fontWeight: 500,
      }}
    >
      <span style={{ fontSize: 20, flex: "0 0 auto" }} aria-hidden="true">
        <i className={`ph-bold ${t.icon}`} />
      </span>
      <span style={{ flex: 1 }}>{children}</span>
      {action}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="إخفاء"
          style={{ border: "none", background: "transparent", color: "inherit", fontSize: 18, cursor: "pointer" }}
        >
          <i className="ph-bold ph-x" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export function Skeleton({
  width = "100%",
  height = 16,
  radius = "var(--radius-sm)",
  circle = false,
}: {
  width?: number | string;
  height?: number;
  radius?: string;
  circle?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        width: circle ? height : width,
        height,
        borderRadius: circle ? "50%" : radius,
        background: "linear-gradient(90deg, var(--surface-quiet) 25%, var(--bg-sunken) 37%, var(--surface-quiet) 63%)",
        backgroundSize: "400% 100%",
        animation: "fady-shimmer 1400ms ease-in-out infinite",
      }}
    />
  );
}

/** §8.3: skeletons match the final card shape. */
export function SkeletonCard() {
  return (
    <div
      style={{
        background: "var(--surface-card)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--card-pad)",
        boxShadow: "var(--shadow-card)",
        display: "grid",
        gap: "var(--space-3)",
      }}
    >
      <Skeleton width="45%" height={22} />
      <Skeleton width="70%" height={14} />
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <Skeleton width={92} height={40} radius="var(--radius-pill)" />
        <Skeleton width={92} height={40} radius="var(--radius-pill)" />
      </div>
    </div>
  );
}

export function Toast({
  children,
  tone = "neutral",
  visible = true,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "danger";
  visible?: boolean;
}) {
  const tones = {
    neutral: { background: "var(--surface-inverse)", color: "var(--bg-page)" },
    success: { background: "var(--success)", color: "#04231C" },
    danger: { background: "var(--danger)", color: "#fff" },
  } as const;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: visible ? "flex" : "none",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "12px 20px",
        borderRadius: "var(--radius-pill)",
        boxShadow: "var(--shadow-pop)",
        font: "var(--label-md)",
        fontWeight: 700,
        ...tones[tone],
      }}
    >
      {children}
    </div>
  );
}
