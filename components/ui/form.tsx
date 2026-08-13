"use client";

import { useId, type ReactNode } from "react";

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div style={{ display: "grid", gap: "var(--space-2)" }}>
      {label ? (
        <label htmlFor={htmlFor} style={{ font: "var(--label-md)", color: "var(--text-strong)", fontWeight: 700 }}>
          {label}
        </label>
      ) : null}
      {children}
      {/* §8.4: the field message sits next to the field it belongs to. */}
      {error ? (
        <span style={{ font: "var(--body-sm)", color: "var(--danger)", fontWeight: 500 }}>{error}</span>
      ) : hint ? (
        <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>{hint}</span>
      ) : null}
    </div>
  );
}

export function Input({
  label,
  name,
  defaultValue,
  value,
  onChange,
  placeholder,
  hint,
  error,
  prefix,
  type = "text",
  id,
  dir = "auto",
  maxLength,
  required,
  autoComplete,
  inputMode,
}: {
  label?: string;
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  prefix?: string;
  type?: string;
  id?: string;
  dir?: "auto" | "rtl" | "ltr";
  maxLength?: number;
  required?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "email" | "numeric" | "tel" | "url";
}) {
  const generated = useId();
  const inputId = id ?? `${name ?? "field"}-${generated}`;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId}>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          background: "var(--surface-card)",
          border: `2px solid ${error ? "var(--danger)" : "var(--border-hairline)"}`,
          borderRadius: "var(--radius-md)",
          padding: "0 16px",
          minHeight: 52,
        }}
      >
        {prefix ? <span style={{ font: "var(--body-md)", color: "var(--text-faint)" }}>{prefix}</span> : null}
        <input
          id={inputId}
          name={name}
          type={type}
          dir={dir}
          inputMode={inputMode}
          required={required}
          autoComplete={autoComplete}
          defaultValue={onChange ? undefined : defaultValue}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          aria-invalid={error ? true : undefined}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            font: "var(--body-lg)",
            color: "var(--text-strong)",
            minWidth: 0,
          }}
        />
      </span>
    </Field>
  );
}

export function Textarea({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
  error,
  maxLength,
  rows = 3,
}: {
  label?: string;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  maxLength?: number;
  rows?: number;
}) {
  const generated = useId();
  const id = `${name ?? "textarea"}-${generated}`;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        dir="auto"
        maxLength={maxLength}
        placeholder={placeholder}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        style={{
          background: "var(--surface-card)",
          border: `2px solid ${error ? "var(--danger)" : "var(--border-hairline)"}`,
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
          font: "var(--body-md)",
          color: "var(--text-strong)",
          resize: "vertical",
          outline: "none",
        }}
      />
    </Field>
  );
}

export function Select({
  label,
  name,
  defaultValue,
  options,
  hint,
  error,
}: {
  label?: string;
  name?: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  hint?: string;
  error?: string;
}) {
  const generated = useId();
  const id = `${name ?? "select"}-${generated}`;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        style={{
          background: "var(--surface-card)",
          border: `2px solid ${error ? "var(--danger)" : "var(--border-hairline)"}`,
          borderRadius: "var(--radius-md)",
          padding: "0 16px",
          minHeight: 52,
          font: "var(--body-md)",
          color: "var(--text-strong)",
          outline: "none",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Switch({
  checked = false,
  onChange,
  label,
  description,
}: {
  checked?: boolean;
  onChange?: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", minHeight: "var(--tap-min)", cursor: "pointer" }}>
      <span style={{ flex: 1, display: "grid", gap: 2 }}>
        <span style={{ font: "var(--title-sm)", color: "var(--text-strong)" }}>{label}</span>
        {description ? <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>{description}</span> : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
      />
      <span
        aria-hidden="true"
        style={{
          width: 56,
          height: 32,
          flex: "0 0 auto",
          borderRadius: "var(--radius-pill)",
          background: checked ? "var(--accent)" : "var(--warm-300)",
          padding: 3,
          display: "flex",
          justifyContent: checked ? "flex-start" : "flex-end",
          transition: "background var(--dur-base) var(--ease-out)",
        }}
      >
        <span style={{ width: 26, height: 26, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 4px rgba(34,23,20,.35)" }} />
      </span>
    </label>
  );
}

/** AVL-003 quick blocks. `crossesMidnight` marks the 12–2 ص block as +١ day. */
export function TimeBlockChip({
  children,
  selected = false,
  disabled = false,
  crossesMidnight = false,
  onClick,
}: {
  children: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  crossesMidnight?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      style={{
        minHeight: "var(--tap-min)",
        padding: "10px 18px",
        borderRadius: "var(--radius-pill)",
        font: "var(--label-md)",
        fontWeight: selected ? 700 : 500,
        color: selected ? "var(--text-on-accent)" : "var(--text-strong)",
        background: selected ? "var(--accent)" : "var(--surface-card)",
        border: `${selected ? "var(--border-width-thick)" : "var(--border-width)"} solid ${
          selected ? "var(--accent)" : "var(--border-hairline)"
        }`,
        boxShadow: selected ? "var(--shadow-sticker-sm)" : "none",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        transition: "all var(--dur-fast) var(--ease-out)",
      }}
    >
      {children}
      {crossesMidnight ? <span style={{ font: "var(--label-sm)", opacity: 0.75, fontWeight: 500 }}>+١</span> : null}
    </button>
  );
}

export function SegmentedTabs<T extends string>({
  items,
  active,
  onChange,
  label = "تبويبات",
}: {
  items: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  label?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--bg-sunken)", borderRadius: "var(--radius-pill)" }}
    >
      {items.map((it) => {
        const on = it.id === active;
        return (
          <button
            key={it.id}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(it.id)}
            style={{
              border: "none",
              minHeight: 38,
              padding: "0 18px",
              borderRadius: "var(--radius-pill)",
              font: "var(--label-md)",
              fontWeight: 700,
              cursor: "pointer",
              background: on ? "var(--surface-card)" : "transparent",
              color: on ? "var(--text-strong)" : "var(--text-muted)",
              boxShadow: on ? "var(--shadow-card)" : "none",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
