"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Banner, Card, EmptyState } from "@/components/ui/card";
import { Avatar, Wordmark } from "@/components/ui/identity";
import { sendFriendRequest } from "@/lib/actions/friends";
import { storeFriendIntent } from "@/lib/actions/invite-intent";
import { errorMessage } from "@/lib/domain/errors";

export function FriendInvitePanel({
  username,
  target,
  signedIn,
  isSelf = false,
}: {
  username: string | null;
  target: { id: string; username: string; displayName: string } | null;
  signedIn: boolean;
  isSelf?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function add() {
    if (!target) return;
    setError(null);
    startTransition(async () => {
      const result = await sendFriendRequest(target.id);
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      setDone(true);
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

        {error ? <Banner tone="error">{error}</Banner> : null}

        {!username ? (
          <EmptyState title="الرابط ما عاد شغال" body="اطلب رابط جديد من صاحبك." />
        ) : !signedIn ? (
          <>
            <Card variant="sticker" tilt="b" tone="celebrate">
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: "var(--text-strong)" }}>
                جاك رابط صداقة في فاضي؟
              </span>
            </Card>
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <Button size="lg" block onClick={() => startTransition(() => storeFriendIntent(username, "sign-up"))}>
                سو حساب
              </Button>
              <Button tone="quiet" size="lg" block onClick={() => startTransition(() => storeFriendIntent(username, "sign-in"))}>
                عندي حساب
              </Button>
            </div>
          </>
        ) : isSelf ? (
          <EmptyState title="هذا رابطك أنت" body="شاركه مع أصحابك عشان يضيفونك." />
        ) : !target ? (
          <EmptyState title="ما لقينا هذا الحساب" body="تأكد من اسم المستخدم." />
        ) : done ? (
          <EmptyState
            icon={<i className="ph-bold ph-check-circle" aria-hidden="true" />}
            title="أرسلنا الطلب"
            body={`ننتظر ${target.displayName} يقبل.`}
            action={
              <Button tone="quiet" onClick={() => router.push("/friends")}>
                أصدقائي
              </Button>
            }
          />
        ) : (
          <>
            <Card variant="flat">
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                <Avatar name={target.displayName} size="lg" />
                <div style={{ display: "grid", gap: 2 }}>
                  <span style={{ font: "var(--title-md)", color: "var(--text-strong)" }}>{target.displayName}</span>
                  <span style={{ font: "var(--body-sm)", color: "var(--text-muted)", direction: "ltr" }}>
                    @{target.username}
                  </span>
                </div>
              </div>
            </Card>
            <Button size="lg" block loading={pending} onClick={add}>
              أضف صديق
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
