"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Banner, EmptyState } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { requestPasswordReset } from "@/lib/actions/auth";
import { errorMessage } from "@/lib/domain/errors";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(String(formData.get("email") ?? ""));
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      setSent(true);
    });
  }

  // Neutral confirmation for known and unknown addresses alike (AUTH-006).
  if (sent) {
    return (
      <EmptyState
        icon={<i className="ph-bold ph-paper-plane-tilt" aria-hidden="true" />}
        title="راجع إيميلك"
        body="إذا الإيميل مسجّل عندنا، بيوصلك رابط تغيير كلمة السر."
      />
    );
  }

  return (
    <form action={onSubmit} style={{ display: "grid", gap: "var(--space-5)" }}>
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 32, color: "var(--text-strong)" }}>
        نسيت كلمة السر
      </h1>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Input label="الإيميل" name="email" type="email" dir="ltr" autoComplete="email" required inputMode="email" />
      <Button type="submit" size="lg" block loading={pending}>
        أرسل الرابط
      </Button>
      <div style={{ font: "var(--body-sm)", textAlign: "center" }}>
        <a href="/auth/sign-in">رجوع للدخول</a>
      </div>
    </form>
  );
}
