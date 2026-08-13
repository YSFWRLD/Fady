"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Banner, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { ShareButton } from "@/components/share-button";
import { createGroup } from "@/lib/actions/groups";
import { errorMessage } from "@/lib/domain/errors";

export function NewGroupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ groupId: string; url: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    const name = String(formData.get("name") ?? "");
    startTransition(async () => {
      const result = await createGroup({ name });
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      setCreated({ groupId: result.data.groupId, url: result.data.inviteUrl, name });
      router.refresh();
    });
  }

  // The raw invite token is returned exactly once (INV-001), so it is shown here
  // for sharing before we navigate away.
  if (created) {
    return (
      <div style={{ display: "grid", gap: "var(--space-5)" }}>
        <Card variant="sticker" tilt="b" tone="celebrate">
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: "var(--text-strong)" }}>
              جهّزنا {created.name} 🎉
            </span>
            <span style={{ font: "var(--body-md)", color: "var(--text-body)" }}>أرسل الرابط للشلة عشان ينضمون.</span>
          </div>
        </Card>

        <ShareButton
          url={created.url}
          text={`انضم لقروب ${created.name} في فاضي؟`}
          label="شارك رابط القروب"
          tone="primary"
        />

        <Button tone="quiet" size="lg" block onClick={() => router.push(`/groups/${created.groupId}`)}>
          افتح القروب
        </Button>
      </div>
    );
  }

  return (
    <form action={onSubmit} style={{ display: "grid", gap: "var(--space-5)", maxWidth: 420 }}>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Input label="اسم القروب" name="name" placeholder="الشباب" maxLength={40} required />
      <Button type="submit" size="lg" block loading={pending}>
        سو قروب
      </Button>
    </form>
  );
}
