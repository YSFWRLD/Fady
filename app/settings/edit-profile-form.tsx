"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Banner, Card, Toast } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { updateProfile } from "@/lib/actions/profile";
import { errorMessage } from "@/lib/domain/errors";

export function EditProfileForm({ displayName, username }: { displayName: string; username: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    setFieldError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateProfile({
        displayName: String(formData.get("displayName") ?? ""),
        username: String(formData.get("username") ?? ""),
      });
      if (!result.ok) {
        // PRO-002: a case-insensitive duplicate is rejected with this exact copy.
        if (result.error.field === "username") setFieldError("اسم المستخدم مستخدم");
        else setError(errorMessage(result.error));
        return;
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <Card variant="flat">
      <form action={onSubmit} style={{ display: "grid", gap: "var(--space-4)" }}>
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Input label="اسمك" name="displayName" defaultValue={displayName} maxLength={50} required />
        <Input
          label="اسم المستخدم"
          name="username"
          defaultValue={username}
          dir="ltr"
          prefix="@"
          maxLength={20}
          required
          error={fieldError ?? undefined}
        />
        <Button type="submit" loading={pending}>
          احفظ
        </Button>
        {saved ? <Toast tone="success">حفظنا التعديل</Toast> : null}
      </form>
    </Card>
  );
}
