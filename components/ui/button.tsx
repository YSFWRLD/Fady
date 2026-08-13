"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

type ButtonSize = "sm" | "md" | "lg";
type ButtonTone = "primary" | "secondary" | "quiet" | "outline" | "danger";

const SIZES: Record<ButtonSize, CSSProperties> = {
  lg: { font: "var(--title-md)", padding: "14px 26px", minHeight: 52 },
  md: { font: "var(--label-md)", padding: "11px 22px", minHeight: 44 },
  sm: { font: "var(--label-sm)", padding: "8px 16px", minHeight: 36 },
};

const TONES: Record<ButtonTone, CSSProperties> = {
  primary: { background: "var(--accent)", color: "var(--text-on-accent)", border: "2px solid transparent" },
  secondary: { background: "var(--accent-2)", color: "var(--text-on-band)", border: "2px solid transparent" },
  quiet: { background: "var(--surface-quiet)", color: "var(--text-body)", border: "2px solid transparent" },
  outline: { background: "transparent", color: "var(--text-strong)", border: "2px solid var(--border-strong)" },
  danger: { background: "var(--danger)", color: "#fff", border: "2px solid transparent" },
};

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        animation: "fady-spin 700ms linear infinite",
        flex: "0 0 auto",
      }}
    />
  );
}

export function Button({
  children,
  tone = "primary",
  size = "md",
  block = false,
  disabled = false,
  loading = false,
  icon,
  type = "button",
  onClick,
  title,
  ariaLabel,
}: {
  children?: ReactNode;
  tone?: ButtonTone;
  size?: ButtonSize;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  title?: string;
  ariaLabel?: string;
}) {
  const s = SIZES[size];
  const t = TONES[tone];
  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={{
        font: s.font,
        padding: s.padding,
        minHeight: s.minHeight,
        width: block ? "100%" : undefined,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        borderRadius: "var(--radius-pill)",
        fontFamily: "var(--font-body)",
        fontWeight: 700,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        boxShadow: tone === "outline" ? "none" : "var(--shadow-sticker-sm)",
        transition:
          "transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)",
        ...t,
      }}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

/** Anchor styled as a Button — for navigation rather than mutation. */
export function LinkButton({
  children,
  href,
  tone = "primary",
  size = "md",
  block = false,
  icon,
}: {
  children?: ReactNode;
  href: string;
  tone?: ButtonTone;
  size?: ButtonSize;
  block?: boolean;
  icon?: ReactNode;
}) {
  const s = SIZES[size];
  const t = TONES[tone];
  return (
    <Link
      href={href}
      style={{
        font: s.font,
        padding: s.padding,
        minHeight: s.minHeight,
        width: block ? "100%" : undefined,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        borderRadius: "var(--radius-pill)",
        fontFamily: "var(--font-body)",
        fontWeight: 700,
        textDecoration: "none",
        boxShadow: tone === "outline" ? "none" : "var(--shadow-sticker-sm)",
        ...t,
      }}
    >
      {icon}
      {children}
    </Link>
  );
}

export function IconButton({
  icon,
  label,
  tone = "quiet",
  size = 44,
  badge,
  onClick,
  type = "button",
}: {
  icon: ReactNode;
  label: string;
  tone?: "quiet" | "plain" | "accent";
  size?: number;
  badge?: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const tones = {
    quiet: { background: "var(--surface-quiet)", color: "var(--text-body)" },
    plain: { background: "transparent", color: "var(--text-body)" },
    accent: { background: "var(--accent)", color: "var(--text-on-accent)" },
  } as const;
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        position: "relative",
        width: size,
        height: size,
        flex: "0 0 auto",
        display: "inline-grid",
        placeItems: "center",
        borderRadius: "var(--radius-pill)",
        border: "none",
        fontSize: 22,
        cursor: "pointer",
        ...tones[tone],
      }}
    >
      {icon}
      {badge ? (
        <span
          style={{
            position: "absolute",
            top: 4,
            insetInlineEnd: 4,
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: "var(--radius-pill)",
            background: "var(--danger)",
            color: "#fff",
            font: "var(--label-sm)",
            fontWeight: 700,
            display: "grid",
            placeItems: "center",
            border: "2px solid var(--bg-page)",
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
