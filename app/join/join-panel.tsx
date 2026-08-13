"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Banner, Card } from "@/components/ui/card";
import { Wordmark } from "@/components/ui/identity";
import { redeemGroupInvite } from "@/lib/actions/groups";
import { storeInviteIntent } from "@/lib/actions/invite-intent";
import { errorMessage } from "@/lib/domain/errors";

/**
 * §4.3 — before authorization this panel shows only generic copy. It never
 * reveals the group name, members, plans, or who sent the invite.
 */
export function JoinPanel({ token, signedIn }: { token: string | null; signedIn: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function join() {
    if (!token) return;
    setError(null);
    startTransition(async () => {
      const result = await redeemGroupInvite(token);
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      router.push(`/groups/${result.data.groupId}`);
      router.refresh();
    });
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "var(--space-8) var(--gutter)",
        background: "var(--bg-page)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440, display: "grid", gap: "var(--space-6)" }}>
        <Wordmark size={32} />

        <Card variant="sticker" tilt="b" tone="celebrate">
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color: "var(--text-strong)" }}>
              جاك رابط قروب في فاضي؟
            </span>
            <span style={{ font: "var(--body-md)", color: "var(--text-body)" }}>
              سجّل دخولك عشان تشوف القروب وتنضم له.
            </span>
          </div>
        </Card>

        {error ? (
          <Banner tone="error" action={<a href="/home">الرئيسية</a>}>
            {error}
          </Banner>
        ) : null}

        {!token ? (
          // Invalid, expired, or missing intent — safe recovery state (§4.3).
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <Banner tone="info">الرابط ما عاد شغال. اطلب رابط جديد من اللي أرسله لك.</Banner>
            <Button tone="quiet" size="lg" block onClick={() => router.push("/home")}>
              رجوع
            </Button>
          </div>
        ) : signedIn ? (
          <Button size="lg" block loading={pending} onClick={join}>
            انضم للقروب
          </Button>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <Button size="lg" block onClick={() => startTransition(() => storeInviteIntent(token, "sign-up"))}>
              سو حساب وانضم
            </Button>
            <Button tone="quiet" size="lg" block onClick={() => startTransition(() => storeInviteIntent(token, "sign-in"))}>
              عندي حساب
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
