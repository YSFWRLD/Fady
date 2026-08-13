"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/card";

/**
 * SHR-001/SHR-002 — Web Share where available, with an explicit WhatsApp action
 * and Copy Link fallback otherwise.
 *
 * SHR-005/SHR-006: the message text the user approves may name the plan, but the
 * link itself carries only an opaque token, and nothing about the recipient or
 * the private details is recorded.
 */
export function ShareButton({
  url,
  text,
  label = "شارك",
  tone = "quiet",
  block = false,
}: {
  url: string;
  text: string;
  label?: string;
  tone?: "primary" | "quiet" | "outline";
  block?: boolean;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const message = `${text}\n${url}`;

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        // Cancelled or unsupported — fall through to the manual actions.
      }
    }
    await copy();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setToast("نسخنا الرابط");
    } catch {
      setToast("انسخ الرابط يدويًا");
    }
    startTransition(() => {
      setTimeout(() => setToast(null), 2500);
    });
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-2)", justifyItems: block ? "stretch" : "start" }}>
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <Button tone={tone} block={block} onClick={share} icon={<i className="ph-bold ph-share-network" aria-hidden="true" />}>
          {label}
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            minHeight: 44,
            padding: "11px 22px",
            borderRadius: "var(--radius-pill)",
            background: "var(--surface-quiet)",
            color: "var(--text-body)",
            font: "var(--label-md)",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          <i className="ph-bold ph-whatsapp-logo" aria-hidden="true" />
          واتساب
        </a>
      </div>
      {toast ? <Toast tone="neutral">{toast}</Toast> : null}
    </div>
  );
}
