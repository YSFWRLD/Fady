"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Banner, Card } from "@/components/ui/card";
import { ShareButton } from "@/components/share-button";
import { rotateGroupInvite } from "@/lib/actions/groups";
import { errorMessage } from "@/lib/domain/errors";

/**
 * INV-001 — the server stores only the token hash, so a raw link exists exactly
 * once, at creation or rotation. The card therefore mints a link on demand and
 * shows it in place; INV-003 means minting a new one revokes the previous link.
 */
export function InviteLinkCard({
  groupId,
  groupName,
  canManage,
  hasActiveInvite,
}: {
  groupId: string;
  groupName: string;
  canManage: boolean;
  hasActiveInvite: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function rotate() {
    setError(null);
    startTransition(async () => {
      const result = await rotateGroupInvite(groupId);
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      setUrl(result.data.url);
    });
  }

  if (!canManage) {
    return (
      <Card variant="flat" tone="quiet">
        <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
          تبي تضيف أحد؟ اطلب من الأدمن رابط الدعوة.
        </span>
      </Card>
    );
  }

  return (
    <Card variant="flat" tone="quiet">
      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        <span style={{ font: "var(--label-md)", fontWeight: 700, color: "var(--text-strong)" }}>
          أرسل الرابط للشلة
        </span>
        <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
          الرابط ينتهي بعد ٣٠ يوم. لما تنشئ رابط جديد، القديم يتوقف على طول.
        </span>

        {error ? <Banner tone="error">{error}</Banner> : null}

        {url ? (
          <>
            <span style={{ font: "var(--mono-sm)", color: "var(--text-muted)", direction: "ltr", wordBreak: "break-all" }}>
              {url}
            </span>
            <ShareButton url={url} text={`انضم لقروب ${groupName} في فاضي؟`} label="شارك رابط القروب" tone="primary" />
          </>
        ) : (
          <Button tone="quiet" loading={pending} onClick={rotate} icon={<i className="ph-bold ph-link" aria-hidden="true" />}>
            {hasActiveInvite ? "أنشئ رابط جديد" : "أنشئ رابط دعوة"}
          </Button>
        )}
      </div>
    </Card>
  );
}
