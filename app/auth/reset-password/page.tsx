"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { updatePassword } from "@/lib/actions/auth";
import { errorMessage } from "@/lib/domain/errors";

/** Reached only after /auth/callback has exchanged the recovery code. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    if (password !== confirm) {
      setError("كلمتي السر ما تطابقن");
      return;
    }

    startTransition(async () => {
      const result = await updatePassword(password);
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      router.push("/home");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} style={{ display: "grid", gap: "var(--space-5)" }}>
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 32, color: "var(--text-strong)" }}>
        كلمة سر جديدة
      </h1>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Input label="كلمة السر الجديدة" name="password" type="password" autoComplete="new-password" required hint="٨ حروف على الأقل" />
      <Input label="أعِد كتابتها" name="confirm" type="password" autoComplete="new-password" required />
      <Button type="submit" size="lg" block loading={pending}>
        احفظ
      </Button>
    </form>
  );
}
